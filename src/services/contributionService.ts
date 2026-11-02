// CampusNotes Student Contributions Service
// Secure public submissions with zero-auth R2 upload and server-side admin management

import { auth, R2_WORKER_URL, DEFAULT_R2_WORKER_URL, getR2WorkerUrl } from '../config/firebase';
import { StudentSubmission, SubmissionCategory, AcademicCategory } from '../types';
import { validateClientFile } from '../utils/fileTypes';
import { MAX_FILE_SIZE_BYTES } from './firebaseService';

export interface ContributionFormData {
  studentName: string;
  email?: string;
  college?: string;
  materialTitle: string;
  description?: string;
  semesterId: string;
  subjectId: string;
  category: SubmissionCategory | AcademicCategory;
  honeypot?: string;
  formStartTime?: number;
}

export interface ContributionSubmitResult {
  ok: boolean;
  submissionId: string;
  message: string;
}

export function getWorkerBaseUrl(): string {
  const url = typeof getR2WorkerUrl === 'function' ? getR2WorkerUrl() : (R2_WORKER_URL || DEFAULT_R2_WORKER_URL);
  return url.replace(/\/+$/, '');
}

/**
 * Submits a public student contribution without requiring user login or Firebase Auth.
 * Follows the two-step secure direct-to-R2 upload workflow with live upload progress.
 */
export async function submitStudentContribution(
  data: ContributionFormData,
  file: File,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<ContributionSubmitResult> {
  // 1. Client-side file validation
  const validation = await validateClientFile(file, MAX_FILE_SIZE_BYTES);
  if (!validation.valid) {
    throw new Error(validation.error || 'The selected file is not valid or supported.');
  }

  const workerBase = getWorkerBaseUrl();
  const initEndpoint = `${workerBase}/submissions/init`;

  // 2. Step 1: Initialize submission on the backend
  let initRes: Response;
  try {
    initRes = await fetch(initEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentName: data.studentName.trim(),
        email: data.email?.trim() || undefined,
        college: data.college?.trim() || undefined,
        materialTitle: data.materialTitle.trim(),
        description: data.description?.trim() || undefined,
        semesterId: data.semesterId,
        subjectId: data.subjectId,
        category: data.category,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || validation.formatInfo?.mimeType || 'application/octet-stream',
        honeypot: data.honeypot || '',
        formStartTime: data.formStartTime || Date.now() - 5000,
      }),
      signal,
    });
  } catch (netErr: unknown) {
    const netMsg = netErr instanceof Error ? netErr.message : String(netErr);
    console.error('[ContributionService] Network error during initialization:', {
      initEndpoint,
      error: netMsg,
    });
    throw new Error(`Unable to connect to upload service at ${workerBase}. Please check your connection or verify Worker is running.`);
  }

  if (!initRes.ok) {
    let serverError = '';
    try {
      const errData = await initRes.json();
      serverError = errData.error || '';
    } catch {
      // ignore JSON parse error
    }

    let errMsg = `Submission initialization failed [HTTP ${initRes.status}]`;
    if (serverError && serverError !== 'Not found') {
      errMsg = serverError;
    } else if (initRes.status === 404) {
      errMsg = `Endpoint not found (HTTP 404 on ${initEndpoint}). Active Worker: ${workerBase}`;
    } else if (serverError) {
      errMsg = serverError;
    }

    console.error('[ContributionService] Initialization error response:', {
      url: initEndpoint,
      status: initRes.status,
      statusText: initRes.statusText,
      serverError,
      workerBase,
    });
    throw new Error(errMsg);
  }

  const initData = (await initRes.json()) as {
    ok: boolean;
    submissionId: string;
    uploadToken: string;
    uploadUrl: string;
  };

  // 3. Step 2: Upload original binary file directly to Worker/R2 with XHR progress telemetry
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', initData.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || validation.formatInfo?.mimeType || 'application/octet-stream');
    xhr.setRequestHeader('X-Upload-Token', initData.uploadToken);

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload was cancelled.'));
      });
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          onProgress(percent, evt.loaded, evt.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          onProgress?.(100, file.size, file.size);
          resolve({
            ok: true,
            submissionId: initData.submissionId,
            message:
              res.message ||
              'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.',
          });
        } catch {
          resolve({
            ok: true,
            submissionId: initData.submissionId,
            message:
              'Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval.',
          });
        }
      } else {
        let errorMsg = `Upload failed [HTTP ${xhr.status}]`;
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.error) errorMsg = res.error;
        } catch {
          // ignore
        }
        console.error('[ContributionService] Binary upload failed:', {
          uploadUrl: initData.uploadUrl,
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
        });
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      console.error('[ContributionService] XHR network error:', {
        uploadUrl: initData.uploadUrl,
      });
      reject(new Error(`Network error during file upload to ${initData.uploadUrl}. Please check your connection and try again.`));
    };

    xhr.ontimeout = () => {
      console.error('[ContributionService] XHR upload timeout:', {
        uploadUrl: initData.uploadUrl,
      });
      reject(new Error('Upload timed out after 5 minutes. Please try again with a faster connection.'));
    };

    xhr.timeout = 300000; // 5 minutes for files up to 50 MB
    xhr.send(file);
  });
}

/**
 * Admin: Fetch all student submissions with status filter
 */
export async function fetchSubmissionsAdmin(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'): Promise<StudentSubmission[]> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const res = await fetch(`${workerBase}/submissions?status=${encodeURIComponent(status)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let msg = `Failed to fetch submissions (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err.error) msg = err.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { ok: boolean; submissions: StudentSubmission[] };
  return data.submissions || [];
}

/**
 * Admin: Preview or load pending file blob
 */
export async function fetchSubmissionFileBlobAdmin(submissionId: string): Promise<{ blob: Blob; objectUrl: string; mimeType: string }> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const res = await fetch(`${workerBase}/submissions/${encodeURIComponent(submissionId)}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load submission file (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const mimeType = res.headers.get('Content-Type') || 'application/pdf';
  return { blob, objectUrl, mimeType };
}

/**
 * Admin: Download a pending submission file
 */
export async function downloadSubmissionFileAdmin(submissionId: string, filename: string): Promise<void> {
  const { blob, objectUrl } = await fetchSubmissionFileBlobAdmin(submissionId);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || 'submission_file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
}

/**
 * Admin: Approve a student submission and publish it to public materials
 */
export async function approveSubmissionAdmin(submissionId: string): Promise<{ ok: boolean; materialId: string; submission: StudentSubmission }> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const res = await fetch(`${workerBase}/submissions/${encodeURIComponent(submissionId)}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let msg = `Approval failed (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err.error) msg = err.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await res.json()) as { ok: boolean; materialId: string; submission: StudentSubmission };
}

/**
 * Admin: Reject a student submission
 */
export async function rejectSubmissionAdmin(submissionId: string): Promise<{ ok: boolean; submission: StudentSubmission }> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const res = await fetch(`${workerBase}/submissions/${encodeURIComponent(submissionId)}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let msg = `Rejection failed (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err.error) msg = err.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await res.json()) as { ok: boolean; submission: StudentSubmission };
}

/**
 * Admin: Delete a student submission
 */
export async function deleteSubmissionAdmin(submissionId: string): Promise<boolean> {
  if (!auth?.currentUser) {
    throw new Error('Administrator authentication required.');
  }

  const token = await auth.currentUser.getIdToken();
  const workerBase = getWorkerBaseUrl();
  const res = await fetch(`${workerBase}/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.ok;
}

