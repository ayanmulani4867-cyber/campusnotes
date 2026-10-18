import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim();
});

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
});

const storage = getStorage(app, env.VITE_FIREBASE_STORAGE_BUCKET);
const testRef = ref(storage, 'materials/test_probe_upload.pdf');
const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF');

try {
  console.log('Attempting upload to Cloud Storage...');
  await uploadBytes(testRef, dummyPdf, { contentType: 'application/pdf' });
  const url = await getDownloadURL(testRef);
  console.log('[SUCCESS] Upload succeeded! Download URL:', url);
  await deleteObject(testRef);
  console.log('[SUCCESS] Cleanup probe succeeded!');
} catch (err) {
  console.log('[FAILED] Upload failed:', err.code, err.message);
  if (err.serverResponse) console.log('Server response:', err.serverResponse);
  if (err.customData) console.log('Custom data:', err.customData);
}
