import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

console.log('======================================================================');
console.log('  CAMPUSNOTES — DEEP PERFORMANCE AUDIT & BENCHMARK');
console.log('======================================================================\n');

function measureUrl(urlStr, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const start = performance.now();
    let ttfb = 0;
    let bytes = 0;

    const req = https.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        ttfb = performance.now() - start;

        res.on('data', (chunk) => {
          bytes += chunk.length;
        });

        res.on('end', () => {
          const totalDuration = performance.now() - start;
          resolve({
            statusCode: res.statusCode,
            ttfbMs: Number(ttfb.toFixed(2)),
            totalDurationMs: Number(totalDuration.toFixed(2)),
            bytes,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ error: err.message });
    });

    if (options.timeout) {
      req.setTimeout(options.timeout, () => req.destroy(new Error('Timeout')));
    }

    req.end();
  });
}

async function runBenchmark() {
  console.log('--- 1. Live Render Website Latency (Cold vs Repeat Visit) ---');
  const siteUrl = 'https://campusnotes-ifpr.onrender.com/';

  // Cold request
  const coldSite = await measureUrl(siteUrl);
  console.log(`  Cold Visit:`);
  console.log(`    Status: HTTP ${coldSite.statusCode}`);
  console.log(`    TTFB  : ${coldSite.ttfbMs} ms`);
  console.log(`    Total : ${coldSite.totalDurationMs} ms`);
  console.log(`    CF-Cache: ${coldSite.headers?.['cf-cache-status'] || 'N/A'}`);

  // Repeat request
  const repeatSite = await measureUrl(siteUrl);
  console.log(`  Repeat Visit:`);
  console.log(`    Status: HTTP ${repeatSite.statusCode}`);
  console.log(`    TTFB  : ${repeatSite.ttfbMs} ms`);
  console.log(`    Total : ${repeatSite.totalDurationMs} ms`);
  console.log(`    CF-Cache: ${repeatSite.headers?.['cf-cache-status'] || 'N/A'}\n`);

  console.log('--- 2. Live Cloudflare Worker PDF API Latency ---');
  const workerHealthUrl = 'https://campusnotes-pdf-api.ayanmull8886.workers.dev/health';
  const workerRes = await measureUrl(workerHealthUrl);
  console.log(`  Worker Health Endpoint:`);
  console.log(`    Status: HTTP ${workerRes.statusCode}`);
  console.log(`    TTFB  : ${workerRes.ttfbMs} ms`);
  console.log(`    Total : ${workerRes.totalDurationMs} ms\n`);

  console.log('--- 3. Live PDF Delivery (Cold vs Repeat / Byte-Range Support) ---');
  // Sample material PDF on worker
  const samplePdfUrl = 'https://campusnotes-ifpr.onrender.com/demo-pdfs/23CS3501-A1.pdf';
  const coldPdf = await measureUrl(samplePdfUrl);
  console.log(`  Static/Demo PDF (${coldPdf.bytes} bytes):`);
  console.log(`    Status: HTTP ${coldPdf.statusCode}`);
  console.log(`    TTFB  : ${coldPdf.ttfbMs} ms`);
  console.log(`    Total : ${coldPdf.totalDurationMs} ms`);
  console.log(`    Accept-Ranges: ${coldPdf.headers?.['accept-ranges'] || 'none'}\n`);

  console.log('--- 4. Firebase Realtime Database Query Latency ---');
  const rtdbUrl = 'https://campusnotes-e62cf-default-rtdb.firebaseio.com/publicMaterials.json?shallow=true';
  const coldRtdb = await measureUrl(rtdbUrl);
  console.log(`  Firebase RTDB Public Materials (Cold):`);
  console.log(`    Status: HTTP ${coldRtdb.statusCode}`);
  console.log(`    TTFB  : ${coldRtdb.ttfbMs} ms`);
  console.log(`    Total : ${coldRtdb.totalDurationMs} ms`);

  const repeatRtdb = await measureUrl(rtdbUrl);
  console.log(`  Firebase RTDB Public Materials (Repeat):`);
  console.log(`    Status: HTTP ${repeatRtdb.statusCode}`);
  console.log(`    TTFB  : ${repeatRtdb.ttfbMs} ms`);
  console.log(`    Total : ${repeatRtdb.totalDurationMs} ms\n`);

  console.log('--- 5. Client Bundle Sizes & Critical Path (dist/assets) ---');
  const distAssets = 'dist/assets';
  let totalJs = 0;
  let totalCss = 0;
  const chunkDetails = [];
  if (fs.existsSync(distAssets)) {
    const files = fs.readdirSync(distAssets);
    for (const file of files) {
      const stat = fs.statSync(path.join(distAssets, file));
      const sizeKb = (stat.size / 1024).toFixed(2);
      if (file.endsWith('.js')) {
        totalJs += stat.size;
        chunkDetails.push({ name: file, sizeKb: Number(sizeKb), type: 'JS' });
      } else if (file.endsWith('.css')) {
        totalCss += stat.size;
        chunkDetails.push({ name: file, sizeKb: Number(sizeKb), type: 'CSS' });
      }
    }
  }

  // Sort chunks by size
  chunkDetails.sort((a, b) => b.sizeKb - a.sizeKb);
  console.log(`  Total JS : ${(totalJs / 1024).toFixed(2)} KB`);
  console.log(`  Total CSS: ${(totalCss / 1024).toFixed(2)} KB`);
  console.log(`  Top Chunks:`);
  for (const c of chunkDetails.slice(0, 6)) {
    console.log(`    - ${c.name} (${c.type}): ${c.sizeKb} KB`);
  }
  console.log('\n======================================================================');
}

runBenchmark();
