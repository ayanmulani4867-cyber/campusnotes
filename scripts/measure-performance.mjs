import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

console.log('======================================================================');
console.log('  CAMPUSNOTES — REAL REPEATABLE PERFORMANCE MEASUREMENT BENCHMARK');
console.log('======================================================================\n');

// 1. Measure Bundle Sizes in dist/assets
console.log('--- 1. Client Bundle Size Analysis (dist/assets) ---');
const distAssets = 'dist/assets';
let totalJsBytes = 0;
let totalCssBytes = 0;
const bundleFiles = [];

if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  for (const file of files) {
    const filePath = path.join(distAssets, file);
    const stat = fs.statSync(filePath);
    if (file.endsWith('.js')) {
      totalJsBytes += stat.size;
      bundleFiles.push({ name: file, type: 'JS', sizeKb: (stat.size / 1024).toFixed(2) });
    } else if (file.endsWith('.css')) {
      totalCssBytes += stat.size;
      bundleFiles.push({ name: file, type: 'CSS', sizeKb: (stat.size / 1024).toFixed(2) });
    }
  }

  bundleFiles.sort((a, b) => parseFloat(b.sizeKb) - parseFloat(a.sizeKb));
  for (const b of bundleFiles) {
    console.log(`  ${b.type.padEnd(4)} ${b.sizeKb.padStart(8)} KB : ${b.name}`);
  }
  console.log(`  TOTAL JS : ${(totalJsBytes / 1024).toFixed(2)} KB (${(totalJsBytes / (1024 * 1024)).toFixed(3)} MB)`);
  console.log(`  TOTAL CSS: ${(totalCssBytes / 1024).toFixed(2)} KB\n`);
} else {
  console.log('  [dist/assets not found, build needed]\n');
}

// 2. Measure Live Network Request Latencies (TTFB & Duration)
function measureUrl(urlStr, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const start = performance.now();
    let ttfb = 0;
    let bytes = 0;

    const req = client.request(url, { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
      ttfb = performance.now() - start;

      res.on('data', (chunk) => {
        bytes += chunk.length;
      });

      res.on('end', () => {
        const totalDuration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          ttfbMs: ttfb.toFixed(2),
          totalDurationMs: totalDuration.toFixed(2),
          bytes,
          headers: res.headers,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ error: err.message });
    });

    if (options.timeout) {
      req.setTimeout(options.timeout, () => {
        req.destroy(new Error('Timeout'));
      });
    }

    req.end();
  });
}

async function runNetworkBenchmarks() {
  console.log('--- 2. Live Cloudflare Worker & Render Network Latency Measurements ---');

  // Benchmark 1: Cloudflare Worker Health
  const workerHealthUrl = 'https://campusnotes-pdf-api.ayanmull8886.workers.dev/health';
  const workerRes = await measureUrl(workerHealthUrl);
  if (workerRes.error) {
    console.log(`  Worker Health (${workerHealthUrl}): Error - ${workerRes.error}`);
  } else {
    console.log(`  Cloudflare Worker Health: HTTP ${workerRes.statusCode}`);
    console.log(`    Time To First Byte (TTFB): ${workerRes.ttfbMs} ms`);
    console.log(`    Total Request Duration   : ${workerRes.totalDurationMs} ms`);
    console.log(`    Response Size            : ${workerRes.bytes} bytes`);
  }

  // Benchmark 2: Production Render Website
  const renderUrl = 'https://campusnotes-ifpr.onrender.com/';
  const renderRes = await measureUrl(renderUrl);
  if (renderRes.error) {
    console.log(`  Render Website (${renderUrl}): Error - ${renderRes.error}`);
  } else {
    console.log(`\n  Render Production Frontend: HTTP ${renderRes.statusCode}`);
    console.log(`    Time To First Byte (TTFB): ${renderRes.ttfbMs} ms`);
    console.log(`    Total Request Duration   : ${renderRes.totalDurationMs} ms`);
    console.log(`    Payload Size             : ${renderRes.bytes} bytes`);
    console.log(`    Content-Encoding         : ${renderRes.headers['content-encoding'] || 'none'}`);
  }

  // Benchmark 3: Demo PDF Streaming Latency (Representing representative study material)
  const demoPdfUrl = 'https://campusnotes-ifpr.onrender.com/demo-pdfs/assignments/23CS3501_Assignment_1_Multithreading.pdf';
  const pdfRes = await measureUrl(demoPdfUrl);
  if (pdfRes.error) {
    console.log(`  PDF Download (${demoPdfUrl}): Error - ${pdfRes.error}`);
  } else {
    console.log(`\n  Sample Assignment PDF (45 KB): HTTP ${pdfRes.statusCode}`);
    console.log(`    Time To First Byte (TTFB): ${pdfRes.ttfbMs} ms`);
    console.log(`    Total Download Duration  : ${pdfRes.totalDurationMs} ms`);
    console.log(`    Payload Size             : ${pdfRes.bytes} bytes`);
    console.log(`    Content-Type             : ${pdfRes.headers['content-type']}`);
    console.log(`    Accept-Ranges            : ${pdfRes.headers['accept-ranges'] || 'none'}`);
  }

  console.log('\n======================================================================\n');
}

runNetworkBenchmarks();
