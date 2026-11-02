import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';

const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
const rows = db.prepare(`SELECT * FROM _mf_objects WHERE key LIKE '%/metadata.json'`).all();

const submissions = [];
for (const row of rows) {
  const blobFile = path.join(blobsDir, row.blob_id);
  if (fs.existsSync(blobFile)) {
    const data = JSON.parse(fs.readFileSync(blobFile, 'utf8'));
    submissions.push(data);
  }
}

submissions.sort((a, b) => a.submittedAt - b.submittedAt);
console.log(JSON.stringify(submissions, null, 2));

