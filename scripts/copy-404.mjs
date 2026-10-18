import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distIndex = path.join(rootDir, 'dist', 'index.html');
const dist404 = path.join(rootDir, 'dist', '404.html');

if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('✓ Successfully generated dist/404.html for Render SPA routing fallback');
} else {
  console.warn('Notice: dist/index.html not found, skipping 404.html generation');
}
