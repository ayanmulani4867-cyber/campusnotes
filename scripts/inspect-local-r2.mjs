import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';

try {
  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
  const rows = db.prepare(`SELECT * FROM _mf_objects WHERE key LIKE '%/metadata.json'`).all();

  const list = [];
  for (const row of rows) {
    const blobFile = path.join(blobsDir, row.blob_id);
    if (fs.existsSync(blobFile)) {
      const data = JSON.parse(fs.readFileSync(blobFile, 'utf8'));
      list.push({
        id: data.submissionId,
        studentName: data.studentName,
        email: data.email || 'N/A',
        title: data.materialTitle,
        category: data.category,
        fileName: data.originalFilename,
        size: data.fileSize,
        status: data.status,
        submittedAt: new Date(data.submittedAt).toISOString(),
        rejectedAt: data.rejectedAt ? new Date(data.rejectedAt).toISOString() : undefined,
        approvedAt: data.approvedAt ? new Date(data.approvedAt).toISOString() : undefined,
      });
    }
  }

  // Sort by date
  list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  console.log(`TOTAL SUBMISSIONS IN LOCAL R2: ${list.length}`);
  console.table(list);
} catch (err) {
  console.error(err);
}
