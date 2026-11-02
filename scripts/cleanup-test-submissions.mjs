import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';

const isExecute = process.argv.includes('--execute');

console.log(`=== CampusNotes Test Contributions Cleanup [Mode: ${isExecute ? 'EXECUTE' : 'DRY-RUN'}] ===\n`);

try {
  const db = new DatabaseSync(dbPath, { open: true });
  const rows = db.prepare(`SELECT * FROM _mf_objects WHERE key LIKE 'pending_submissions/%/metadata.json'`).all();

  console.log(`Found ${rows.length} total pending submission metadata entries in local R2.\n`);

  const identifiedForDeletion = [];
  const identifiedForPreservation = [];

  for (const metaRow of rows) {
    const blobFile = path.join(blobsDir, metaRow.blob_id);
    let data = null;
    if (fs.existsSync(blobFile)) {
      try {
        data = JSON.parse(fs.readFileSync(blobFile, 'utf8'));
      } catch {}
    }

    const subIdMatch = metaRow.key.match(/^pending_submissions\/([^/]+)\/metadata\.json$/);
    const subId = subIdMatch ? subIdMatch[1] : '';

    // Check all objects belonging to this submission (metadata + file)
    const subObjects = db.prepare(`SELECT * FROM _mf_objects WHERE key LIKE 'pending_submissions/' || ? || '/%'`).all(subId);

    const isTest = data && (
      data.studentName === 'Test Student' ||
      data.studentName === 'Verification Student' ||
      data.materialTitle === 'Test Material' ||
      data.materialTitle === 'Integration Test Material' ||
      data.email === 'test@example.com' ||
      data.email === 'student@example.com'
    );

    const item = {
      submissionId: subId,
      studentName: data?.studentName || 'Unknown',
      email: data?.email || 'N/A',
      title: data?.materialTitle || 'Untitled',
      category: data?.category || 'N/A',
      filename: data?.originalFilename || 'Unknown',
      status: data?.status || 'Unknown',
      submittedAt: data?.submittedAt ? new Date(data.submittedAt).toISOString() : 'Unknown',
      objectCount: subObjects.length,
      objects: subObjects.map(o => ({ key: o.key, blob_id: o.blob_id, size: o.size })),
      reason: isTest ? 'Automated integration test submission' : 'Uncertain / Potential genuine',
    };

    if (isTest) {
      identifiedForDeletion.push(item);
    } else {
      identifiedForPreservation.push(item);
    }
  }

  console.log(`Identified for DELETION: ${identifiedForDeletion.length}`);
  console.log(`Identified for PRESERVATION: ${identifiedForPreservation.length}\n`);

  if (identifiedForDeletion.length > 0) {
    console.log('--- Submissions Marked for Deletion ---');
    console.table(identifiedForDeletion.map(i => ({
      id: i.submissionId,
      student: i.studentName,
      title: i.title,
      file: i.filename,
      status: i.status,
      submitted: i.submittedAt,
      objects: i.objectCount,
      reason: i.reason,
    })));
  }

  if (isExecute) {
    console.log('\nExecuting permanent deletion of identified test records...');
    let deletedObjectsCount = 0;
    let deletedBlobsCount = 0;

    for (const item of identifiedForDeletion) {
      for (const obj of item.objects) {
        // Delete SQLite row
        db.prepare(`DELETE FROM _mf_objects WHERE key = ?`).run(obj.key);
        deletedObjectsCount++;

        // Delete blob file
        const blobPath = path.join(blobsDir, obj.blob_id);
        if (fs.existsSync(blobPath)) {
          fs.unlinkSync(blobPath);
          deletedBlobsCount++;
        }
      }
    }

    console.log(`[SUCCESS] Deleted ${deletedObjectsCount} database records and ${deletedBlobsCount} physical storage blob files.`);
  } else {
    console.log('\n[DRY RUN ONLY] No data was modified. Pass --execute after obtaining user approval.');
  }

} catch (err) {
  console.error('Cleanup script error:', err);
}

