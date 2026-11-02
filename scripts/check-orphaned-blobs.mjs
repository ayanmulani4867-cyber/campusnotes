import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/miniflare-R2BucketObject/7a69e15903f156a72c06fc5f043906de0244c3b367436a815d87ce0317b93836.sqlite';
const blobsDir = 'C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/.wrangler/state/v3/r2/campusnotes-pdfs/blobs';

const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
const rows = db.prepare(`SELECT blob_id, key FROM _mf_objects`).all();
const referencedBlobs = new Set(rows.map(r => r.blob_id));

const allBlobFiles = fs.readdirSync(blobsDir);
console.log('Total blob files on disk:', allBlobFiles.length);
console.log('Total objects referenced in DB:', referencedBlobs.size);

const orphanedBlobs = allBlobFiles.filter(f => !referencedBlobs.has(f));
console.log('Orphaned blobs count:', orphanedBlobs.length);
if (orphanedBlobs.length > 0) {
  console.log('Orphaned blob files:', orphanedBlobs);
}

