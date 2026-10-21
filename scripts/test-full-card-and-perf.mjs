import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================================');
console.log('  CAMPUSNOTES — FULL-CARD NAVIGATION & PERFORMANCE VERIFICATION');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Suite 1: Full-Card Clickable Navigation & Accessibility
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Full-Card Clickable Navigation & Accessibility ---');

const materialCardCode = fs.readFileSync('src/components/materials/MaterialCard.tsx', 'utf8');

test('MaterialCard has cursor-pointer and relative positioning on outer container', () => {
  assert(materialCardCode.includes('cursor-pointer'), 'MaterialCard outer container must have cursor-pointer');
  assert(materialCardCode.includes('relative'), 'MaterialCard outer container must be relative for stretched link');
});

test('MaterialCard implements semantic accessibility (role="article", tabIndex={0})', () => {
  assert(materialCardCode.includes('role="article"'), 'MaterialCard missing role="article"');
  assert(materialCardCode.includes('tabIndex={0}'), 'MaterialCard missing tabIndex={0} for keyboard accessibility');
  assert(materialCardCode.includes('aria-label='), 'MaterialCard missing accessible aria-label');
  assert(materialCardCode.includes('focus-visible:ring-2'), 'MaterialCard missing focus-visible accessible ring');
});

test('MaterialCard implements stretched link pseudo-element on title Link', () => {
  assert(materialCardCode.includes('after:absolute after:inset-0'), 'Title link missing after:absolute after:inset-0 stretched link overlay');
  assert(materialCardCode.includes('after:z-0'), 'Stretched link must be z-0 so action buttons sit on top');
});

test('MaterialCard has handleCardClick navigating to /materials/:id', () => {
  assert(materialCardCode.includes('handleCardClick'), 'Missing handleCardClick handler');
  assert(materialCardCode.includes('navigate(materialUrl)'), 'handleCardClick must call navigate(materialUrl)');
  assert(materialCardCode.includes('target.closest('), 'handleCardClick must ignore clicks inside nested interactive elements');
});

test('MaterialCard supports modifier key (Cmd/Ctrl/Shift + Click) to open in new tab', () => {
  assert(materialCardCode.includes('e.metaKey || e.ctrlKey || e.shiftKey'), 'Missing modifier key check for new tab opening');
  assert(materialCardCode.includes("window.open(materialUrl, '_blank')"), 'Missing window.open for modifier key click');
});

test('MaterialCard supports keyboard navigation on Enter or Space', () => {
  assert(materialCardCode.includes('handleKeyDown'), 'Missing handleKeyDown handler');
  assert(materialCardCode.includes("e.key === 'Enter' || e.key === ' '"), 'handleKeyDown must handle Enter and Space');
  assert(materialCardCode.includes('e.preventDefault()'), 'Space key must prevent default page scroll');
});

test('Nested Action Buttons have z-10 and stopPropagation to prevent accidental card navigation', () => {
  assert(materialCardCode.includes('relative z-10 flex items-center gap-1.5'), 'Action buttons container missing relative z-10');
  assert(materialCardCode.includes('onClick={(e) => e.stopPropagation()}'), 'View link missing stopPropagation');
  assert(materialCardCode.includes('handleDownload = async (e: React.MouseEvent) => {\n    e.stopPropagation()'), 'handleDownload missing stopPropagation');
  assert(materialCardCode.includes('handleShare = async (e: React.MouseEvent) => {\n    e.stopPropagation()'), 'handleShare missing stopPropagation');
});

test('Subject link has z-10 and stopPropagation to allow independent subject navigation', () => {
  assert(materialCardCode.includes('className="relative z-10 truncate min-w-0 hover:text-blue-600'), 'Subject link missing relative z-10');
});

// -----------------------------------------------------------------------------
// Suite 2: Fast PDF Downloads & Session Memory Caching
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: PDF Download Optimizations & Caching ---');

const fbServiceCode = fs.readFileSync('src/services/firebaseService.ts', 'utf8');
const pdfViewerCode = fs.readFileSync('src/components/materials/PdfViewer.tsx', 'utf8');

test('firebaseService exports isMaterialPdfCached and getCachedPdfUrl', () => {
  assert(fbServiceCode.includes('export function isMaterialPdfCached('), 'Missing export isMaterialPdfCached');
  assert(fbServiceCode.includes('export function getCachedPdfUrl('), 'Missing export getCachedPdfUrl');
});

test('isMaterialPdfCached supports both Cloudflare R2 and Firebase RTDB blob materials', () => {
  assert(fbServiceCode.includes('material.r2Key || (isR2Material(material) ? `r2_${material.id}` : null)'), 'isMaterialPdfCached does not check R2 cache keys');
  assert(fbServiceCode.includes('extractBlobId(material)'), 'isMaterialPdfCached does not check RTDB blobId');
});

test('downloadStudyMaterial checks instant session memory cache before network calls', () => {
  assert(fbServiceCode.includes('const instantCachedUrl = getCachedPdfUrl(materialInput)'), 'downloadStudyMaterial missing instant cache check');
  assert(fbServiceCode.includes('link.href = instantCachedUrl'), 'downloadStudyMaterial must download from cached URL instantly');
});

test('fetchPdfBlobUrl checks instant session memory cache before network calls', () => {
  assert(fbServiceCode.includes('const instantCachedUrl = getCachedPdfUrl(material)'), 'fetchPdfBlobUrl missing instant cache check');
});

test('PdfViewer uses getCachedPdfUrl on mount for instant preview without network', () => {
  assert(pdfViewerCode.includes('const cachedUrl = getCachedPdfUrl(material)'), 'PdfViewer mount effect missing getCachedPdfUrl');
});

test('PdfViewer automatically activates reader after download using getCachedPdfUrl', () => {
  assert(pdfViewerCode.includes('const newlyCachedUrl = getCachedPdfUrl(material)'), 'PdfViewer download handler missing getCachedPdfUrl');
});

// -----------------------------------------------------------------------------
// Suite 3: Cloudflare Worker Streaming & Headers Optimization
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Cloudflare Worker Streaming & Header Optimization ---');

const workerCode = fs.readFileSync('worker/src/index.ts', 'utf8');

test('Worker streams GET responses directly in single R2 call when no Range header', () => {
  assert(workerCode.includes("request.method === 'GET' && !rangeHeader"), 'Worker missing optimized single R2 call path for full GET');
  assert(workerCode.includes('new Response(fullObj.body, { status: 200, headers })'), 'Worker must stream fullObj.body directly');
});

test('Worker sanitizeFilename ensures .pdf extension is always present', () => {
  assert(workerCode.includes("clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`"), 'Worker sanitizeFilename must guarantee .pdf extension');
});

test('Worker Content-Disposition includes UTF-8 RFC 6266 filename* attribute', () => {
  assert(workerCode.includes("filename*=UTF-8''${encodeURIComponent(safeFilename)}"), 'Worker Content-Disposition missing filename* attribute');
});

test('Worker sets public edge caching for published materials and private for drafts', () => {
  assert(workerCode.includes("headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')"), 'Worker missing safe edge cache for published materials');
  assert(workerCode.includes("headers.set('Cache-Control', 'private, no-store')"), 'Worker missing private no-store for drafts');
});

test('Worker supports RFC 7233 Range headers (206 Partial Content, 416 Unsatisfiable, Accept-Ranges)', () => {
  assert(workerCode.includes("headers.set('Accept-Ranges', 'bytes')"), 'Worker missing Accept-Ranges header');
  assert(workerCode.includes("status: 206"), 'Worker missing 206 status code for Range requests');
  assert(workerCode.includes("status: 416"), 'Worker missing 416 status code for invalid Range requests');
  assert(workerCode.includes("status: 304"), 'Worker missing 304 status code for ETag match');
});

test('Worker supports If-Range validator for safe resumable downloads', () => {
  assert(workerCode.includes("const ifRange = request.headers.get('If-Range')"), 'Worker missing If-Range header handling');
  assert(workerCode.includes("isRangeApplicable"), 'Worker must check If-Range validator match before serving 206');
});

test('Worker includes canonical campusnotes.space in DEFAULT_ALLOWED_ORIGINS and CORS', () => {
  assert(workerCode.includes("'https://campusnotes.space'"), 'Worker missing https://campusnotes.space in DEFAULT_ALLOWED_ORIGINS');
  assert(workerCode.includes("If-Range"), 'Worker Access-Control-Allow-Headers must expose If-Range');
});

test('firebaseService exports high-speed decodeBase64ToUint8Array without string duplication', () => {
  assert(fbServiceCode.includes('export function decodeBase64ToUint8Array('), 'Missing export decodeBase64ToUint8Array');
  assert(fbServiceCode.includes('const bytes = decodeBase64ToUint8Array(cleanData)'), 'base64ToBlob must use decodeBase64ToUint8Array');
});

test('downloadStudyMaterial implements rapid-click debounce and in-flight deduplication', () => {
  assert(fbServiceCode.includes('DOWNLOAD_DEBOUNCE_MS'), 'Missing DOWNLOAD_DEBOUNCE_MS debounce');
  assert(fbServiceCode.includes('inFlightDownloads'), 'Missing inFlightDownloads deduplication');
});

// -----------------------------------------------------------------------------
// Suite 4: Vite Chunk Splitting & Client Bundle Optimization
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Build Optimization & Chunk Splitting ---');

const viteConfigCode = fs.readFileSync('vite.config.ts', 'utf8');

test('vite.config.ts configures manualChunks for vendor-react', () => {
  assert(viteConfigCode.includes('manualChunks(id: string)'), 'vite.config.ts missing manualChunks function');
  assert(viteConfigCode.includes('return \'vendor-react\''), 'vite.config.ts missing vendor-react chunk');
});

console.log('\n======================================================================');
console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
