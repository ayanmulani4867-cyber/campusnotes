# CampusNotes — Large File Uploads (50 MB) & Public Student Contributions Report

## Executive Summary

This report documents the architectural diagnosis, root-cause resolution, and implementation of:
1. **Reliable Large File Uploads up to 50 MB (52,428,800 bytes)** without failure or fallback truncation.
2. **Anonymous Public Student Contributions** ("Contribute Study Materials"), isolated in restricted pending storage until administrator review, approval, and publishing.
3. **Comprehensive Verification & Regression Testing** across all 15 supported formats, frontend routes, and Cloudflare Worker endpoints.

---

## 1. Root Cause Analysis: The ~6 MB "RealmDB" Upload Failure

### 1.1 The Symptom
Files larger than approximately 6 MB failed during upload with an error referencing database/storage limits (colloquially perceived as "RealmDB" or Realtime Database quota limits), while smaller files succeeded.

### 1.2 The Root Cause Chain
1. **Cloudflare Worker CORS Misconfiguration**:
   The deployed Cloudflare Worker (`campusnotes-pdf-api.ayanmull8886.workers.dev`) was configured with `ALLOWED_ORIGINS` strictly pointing to `https://campusnotes-ifpr.onrender.com`. When users accessed the production site at `https://campusnotes.space` or `https://www.campusnotes.space`, the browser's preflight `OPTIONS` or `PUT` request to the Worker was rejected with a CORS header mismatch.
2. **Silent Fallback to Firebase Realtime Database Base64 Storage**:
   In `src/services/firebaseService.ts`, the `uploadPdfFile` function wrapped `uploadPdfToR2` in a `try...catch` block:
   ```typescript
   try {
     return await uploadPdfToR2(materialId, file, onProgress, token);
   } catch (r2Err) {
     console.warn('R2 upload failed, falling back to Firebase RTDB:', r2Err);
     // Fallback to RTDB
   }
   ```
   When R2 failed due to CORS, the code silently fell back to storing the file as a Base64 string directly inside Firebase Realtime Database.
3. **RTDB 6 MB Payload Limitation (The Apparent "RealmDB" Error)**:
   Firebase Realtime Database has a hard 10 MB payload limit per write request. Base64 encoding inflates binary payloads by 33.3%, meaning a 6 MB raw binary file expands to ~8 MB of Base64 text. Furthermore, `firebaseService.ts` explicitly enforced:
   ```typescript
   const MAX_RTDB_PDF_SIZE_BYTES = 6 * 1024 * 1024; // 6 MB
   if (file.size > MAX_RTDB_PDF_SIZE_BYTES) {
     throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds Firebase Realtime Database limit of 6 MB.`);
   }
   ```
   Consequently, files $\le$ 6 MB uploaded into RTDB Base64 without users realizing R2 was failing. Files $>$ 6 MB threw the RTDB limit exception, which presented to users as a database storage quota failure.

---

## 2. Architecture: Large File Uploads (Up to 50 MB)

### 2.1 Uniform 50 MB Boundary
- **Maximum File Size**: `50 * 1024 * 1024` = **`52,428,800` bytes**.
- **Error Message**: `"Maximum file size allowed is 50 MB."` enforced identically in:
  - Frontend client validation: `src/utils/fileTypes.ts`
  - Cloudflare Worker validation: `worker/src/index.ts`
  - Public contribution service: `src/services/contributionService.ts`

### 2.2 Direct-to-R2 Upload Workflow
```
[User Browser]
      |
      | 1. Selects file (<= 52,428,800 bytes)
      v
[Frontend Validation] (magic bytes, format, 50 MB limit)
      |
      | 2. PUT /materials/:id/pdf (XHR with Progress Telemetry)
      |    Headers: Authorization (Firebase Admin ID Token)
      |             Content-Type, X-Filename
      v
[Cloudflare Worker]
      |
      | 3. Verifies Origin & CORS (campusnotes.space, localhost)
      | 4. Verifies Admin Firebase ID Token cryptographically
      | 5. Validates file header / magic bytes (blocks MZ/ELF executables)
      | 6. env.PDF_BUCKET.put(r2Key, buffer)
      v
[Cloudflare R2 Bucket] (materials/:id/:timestamp_:filename)
      |
      | 7. Invalidate Edge & In-memory cache
      v
[Response 200 OK] (r2Key, storagePath, size, etag)
      |
      | 8. Save material metadata to Firebase RTDB (/materials/:id)
      v
[Firebase RTDB] (Only lightweight metadata, NO base64 binaries)
```

### 2.3 Resilient Client-Side Uploads
- **No Silently Masked Failures**: `uploadPdfFile` no longer masks R2 errors for files $> 6$ MB. If R2 fails, the exact network or CORS error is surfaced to the administrator so issues can be diagnosed immediately.
- **Extended Timeout**: XHR upload timeout was increased from 60 seconds to **300 seconds (5 minutes)** in `src/services/firebaseService.ts` and `src/services/contributionService.ts`, ensuring smooth transfers over standard broadband connections.
- **Real-Time Progress**: Native `xhr.upload.onprogress` delivers authentic byte tracking and percentage updates without simulated tickers.

---

## 3. Architecture: Anonymous Public Student Contributions

### 3.1 Public User Journey
1. **Homepage CTA**: A high-visibility button **"Contribute Study Materials"** is featured on the homepage hero section alongside a navigation link in the top Navbar.
2. **Anonymous Access**: Visitors do not need to register or log in. No Firebase Authentication is required for student contributors.
3. **Contribution Form (`/contribute`)**:
   - **Contributor Details**: Name (required), Email (optional), College/Department (optional).
   - **Academic Details**: Material Title (required), Semester (dynamically loaded from active semesters), Subject (filtered by semester), Category (Notes, Assignments, Practical Experiments, Question Papers, Presentations, Other Study Materials), Description (optional).
   - **File Dropzone**: Drag-and-drop or file picker supporting all 15 formats up to 50 MB, with client-side magic-byte inspection and real-time upload progress.
   - **Honeypot Bot Protection**: Hidden field trapping automated spam bots.
   - **Success Confirmation**: Exact message displayed:
     > *"Thank you for contributing to CampusNotes! Your material has been submitted successfully. It will become available after administrator approval."*

### 3.2 Two-Stage Upload Protocol
To prevent anonymous users from writing directly to Firebase Realtime Database or spamming R2:
```
[Anonymous Visitor]
      |
      | 1. POST /submissions/init
      |    Body: { studentName, materialTitle, semesterId, subjectId,
      |            category, originalFilename, fileSize, mimeType, honeypot }
      v
[Cloudflare Worker]
      |
      | - Rate-limit check: Max 10 submissions per 10 min per IP
      | - Honeypot check: Rejects if honeypot is populated
      | - File type & size check: Rejects > 50 MB and prohibited types
      | - Generates cryptographically random uploadToken (valid 15 min)
      v
[Response: { submissionId, uploadToken }]
      |
      | 2. PUT /submissions/:id/upload
      |    Headers: X-Upload-Token: <token>
      |    Body: Raw binary stream (up to 50 MB)
      v
[Cloudflare Worker]
      |
      | - Verifies single-use uploadToken
      | - Validates binary magic bytes header
      | - Writes binary to R2: pending_submissions/:id/:filename
      | - Writes metadata to R2: pending_submissions/:id/meta.json
      v
[Response: { success: true, submissionId, status: 'pending' }]
```

### 3.3 Security & Isolation Controls
- **Zero Public RTDB Writes**: Anonymous contributors never receive write access to Firebase RTDB. No Firebase security rules were weakened.
- **R2 Prefix Isolation**: Pending files reside strictly under `pending_submissions/${submissionId}/...`. They are unreachable by the public `/materials/:id/pdf` endpoint.
- **IP Rate Limiting**: Workers track IP submission timestamps with an in-memory sliding window (10 submissions per 10 minutes).
- **Executable Blocking**: Executable and script extensions (`.exe`, `.bat`, `.sh`, `.cmd`, `.msi`, `.js`, `.py`, `.php`, etc.) as well as Windows PE (`MZ`) and Linux (`ELF`) binaries are blocked at both client and Worker layers.

---

## 4. Admin Dashboard — Student Contributions Section

### 4.1 UI & Capabilities
Integrated seamlessly into the existing Admin Dashboard (`src/pages/admin/AdminDashboardPage.tsx`) under a new **"Student Contributions"** tab with a dynamic pending count badge:
- **Filter Tabs**: `All`, `Pending`, `Approved`, `Rejected`.
- **Contribution Table**:
  - Contributor Name & Contact (Email/College)
  - Material Title & Description
  - Target Semester & Subject
  - Category Badge
  - Format Badge & Formatted File Size
  - Submission Timestamp & Status Badge
- **Action Suite**:
  - **Preview**: Secure in-browser preview modal with streamed blob.
  - **Download**: Direct binary download using admin credentials.
  - **Approve**: Publishes the material directly to public study materials:
    1. Moves file from `pending_submissions/` to `materials/${newMaterialId}/${fileName}` in R2.
    2. Writes canonical metadata to `/materials/${newMaterialId}` in Firebase RTDB.
    3. Updates submission status to `approved` with approving admin email and timestamp.
    4. Automatically appears in the curriculum under the selected subject.
  - **Reject**: Updates status to `rejected`, keeping the file unlisted and hidden.
  - **Delete**: Safely removes the pending record and cleans up R2 storage.

---

## 5. Preservation of All 15 Supported File Formats

CampusNotes continues to support all 15 file formats across documents, presentations, spreadsheets, images, and archives:

| Category | Formats | MIME Types | Magic Byte Verification | Previewable in App |
|---|---|---|---|---|
| **Documents** | `pdf` | `application/pdf` | `%PDF-` | Yes (Universal PDF Viewer) |
| | `doc` | `application/msword` | `0xD0CF11E0A1B11AE1` (OLE CF) | Download Card |
| | `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `PK\x03\x04` (ZIP archive) | Download Card |
| | `txt` | `text/plain` | UTF-8 / ASCII (no null bytes) | Yes (Text Reader) |
| | `rtf` | `application/rtf` | `{\rtf1` | Download Card |
| **Presentations** | `ppt` | `application/vnd.ms-powerpoint` | `0xD0CF11E0A1B11AE1` (OLE CF) | Download Card |
| | `pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `PK\x03\x04` (ZIP archive) | Download Card |
| **Spreadsheets** | `xls` | `application/vnd.ms-excel` | `0xD0CF11E0A1B11AE1` (OLE CF) | Download Card |
| | `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `PK\x03\x04` (ZIP archive) | Download Card |
| | `csv` | `text/csv` | Text (no binary nulls) | Yes (CSV Viewer) |
| **Images** | `jpg`, `jpeg` | `image/jpeg` | `0xFFD8FFE0` / `0xFFD8FFE1` | Yes (Image Viewer) |
| | `png` | `image/png` | `\x89PNG\r\n\x1a\n` | Yes (Image Viewer) |
| | `webp` | `image/webp` | `RIFF....WEBP` | Yes (Image Viewer) |
| **Archives** | `zip` | `application/zip` | `PK\x03\x04` | Download Card |

---

## 6. Verification and Test Results

### 6.1 Worker Test Suite (`worker/test/large-upload-and-contributions.test.mjs`)
- **62 tests passing, 0 failing**:
  - File size tests: 1 MB, 5 MB, 6 MB, 10 MB, 20 MB, 30 MB, 40 MB, 49 MB, 50 MB (accepted).
  - Size boundary check: 52,428,801 bytes rejected with HTTP 413 `"Maximum file size allowed is 50 MB."`.
  - Anonymous submission initialization and token issuance.
  - Honeypot bot rejection.
  - R2 binary upload with uploadToken verification.
  - Pending file isolation (unauthenticated requests to pending files blocked with HTTP 401).
  - Admin listing, preview, approval (moving to public materials), rejection, and safe deletion.
  - Multi-format validation across all 15 formats.

### 6.2 Root Integration Test Suite (`npm test`)
- **9 comprehensive test suites passing, 0 failing**:
  1. `test-full-card-and-perf.mjs` (24/24 passed)
  2. `test-metadata-share.mjs` (15/15 passed)
  3. `test-mobile-and-share.mjs` (26/26 passed)
  4. `test-maintenance-guard-and-no-flash.mjs` (19/19 passed)
  5. `verify-three-pdf-cards-share.mjs` (16/16 passed)
  6. `test-dynamic-semesters.mjs` (20/20 passed)
  7. `test-inactive-semester-visibility.mjs` (27/27 passed)
  8. `test-all-file-formats.mjs` (15/15 passed)
  9. `test-large-upload-and-contributions.mjs` (20/20 passed)

### 6.3 Frontend Production Build (`npm run build`)
- TypeScript typecheck (`tsc -b`) succeeded with 0 errors.
- Vite production bundle produced clean code-split chunks:
  - `ContributePage-*.js`: 15.96 kB
  - `AdminDashboardPage-*.js`: 169.41 kB
  - `dist/404.html` SPA fallback preserved.

---

## 7. Modified and Created Files

| File | Purpose |
|---|---|
| `worker/src/types.ts` | Added `StudentSubmission`, `SubmissionStatus`, `SubmissionCategory` types. |
| `worker/src/index.ts` | Added 50 MB limit, default CORS origins, public submission endpoints, and admin review/approval API. |
| `worker/test/large-upload-and-contributions.test.mjs` | Automated Worker test suite for 1-50 MB file sizes and contribution workflow. |
| `src/types/index.ts` | Added frontend TypeScript interfaces for student submissions and contribution categories. |
| `src/utils/fileTypes.ts` | Updated `MAX_FILE_SIZE_BYTES` to 52,428,800 bytes with exact error message. |
| `src/services/firebaseService.ts` | Extended upload timeout to 300s, removed RTDB fallback for files $>6$ MB. |
| `src/services/contributionService.ts` | Client API layer for public uploads and admin submission management. |
| `src/pages/ContributePage.tsx` | Responsive student contribution page with form validation and real-time progress. |
| `src/components/admin/StudentContributionsSection.tsx` | Admin management table, preview modal, filter tabs, and approve/reject actions. |
| `src/pages/admin/AdminDashboardPage.tsx` | Integrated contributions tab with pending badge counter. |
| `src/pages/HomePage.tsx` | Added "Contribute Study Materials" CTA button. |
| `src/components/common/Navbar.tsx` | Added "Contribute" navigation link. |
| `src/components/common/icons.ts` | Added `Inbox` and `Building` icons to custom Lucide registry. |
| `src/App.tsx` | Registered `/contribute` route with lazy loading. |
| `scripts/test-large-upload-and-contributions.mjs` | Integration test suite for large uploads and contributions. |
| `package.json` | Registered new test script in root `npm test`. |

---

## 8. Deployment and Configuration Instructions (Strict Approval Gate)

> [!IMPORTANT]
> In accordance with safety instructions, **no production deployment or git push has been executed**.
> When you give explicit approval, the following straightforward steps will deploy the updates:

### Step 1: Deploy Cloudflare Worker
Deploy the updated worker using Wrangler:
```bash
cd worker
npx wrangler deploy
```
*Note*: Ensure that the Cloudflare Worker environment variable `ALLOWED_ORIGINS` includes `https://campusnotes.space,https://www.campusnotes.space` (our code also provides this by default in fallback code).

### Step 2: Commit and Push Branch
```bash
git add .
git commit -m "feat: 50 MB large file uploads and public student contributions"
git push -u origin feature/large-file-uploads-and-contributions
```

### Step 3: Deploy Frontend
The frontend build is verified and ready. When the branch is merged into `main`, Render/GitHub Actions will automatically run `npm run build` and deploy the updated application.

