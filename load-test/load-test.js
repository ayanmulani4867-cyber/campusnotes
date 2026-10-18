/**
 * CampusNotes — 500 Concurrent Users Simulation & Performance Test Script
 * Target: Validate performance under ~500 concurrent student browsing & download sessions.
 * 
 * Usage:
 *   node load-test/load-test.js --concurrency=50 --duration=10
 *   node load-test/load-test.js --concurrency=250 --duration=15
 *   node load-test/load-test.js --concurrency=500 --duration=20
 */

import https from 'https';
import http from 'http';

// Configuration
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';
const TARGET_HOST = process.env.TEST_HOST || 'http://localhost:5173';

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v;
  return acc;
}, {});

const CONCURRENCY = parseInt(args.concurrency || '50', 10);
const DURATION_SECONDS = parseInt(args.duration || '10', 10);

console.log('===============================================================');
console.log('  CAMPUSNOTES — LOAD TESTING BENCHMARK FOR CSE SEMESTER 5');
console.log('===============================================================');
console.log(`Concurrency Target:  ${CONCURRENCY} virtual concurrent users`);
console.log(`Duration:            ${DURATION_SECONDS} seconds`);
console.log(`RTDB Endpoint:       ${DATABASE_URL}`);
console.log(`Local Web App Host:  ${TARGET_HOST}`);
console.log('---------------------------------------------------------------\n');

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const latencies = [];

function makeRequest(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const duration = Date.now() - start;
        latencies.push(duration);
        totalRequests++;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        resolve({ status: res.statusCode, duration });
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - start;
      totalRequests++;
      failedRequests++;
      resolve({ status: 0, duration, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.abort();
    });
  });
}

// Representative workloads for CSE Sem 5 students:
// 1. Fetching active subjects
// 2. Fetching published materials index
// 3. Querying specific subject materials
// 4. Client web app home shell
const workloads = [
  `${DATABASE_URL}/subjects.json?shallow=true`,
  `${DATABASE_URL}/publicMaterials.json?orderBy="createdAt"&limitToLast=20`,
  `${TARGET_HOST}/`,
  `${TARGET_HOST}/materials`,
];

async function runWorker(stopTime) {
  while (Date.now() < stopTime) {
    const targetUrl = workloads[Math.floor(Math.random() * workloads.length)];
    await makeRequest(targetUrl);
    // Micro delay to simulate realistic human thinking/reading time (50ms - 200ms)
    await new Promise((r) => setTimeout(r, Math.random() * 150 + 50));
  }
}

async function startLoadTest() {
  const startTime = Date.now();
  const stopTime = startTime + DURATION_SECONDS * 1000;

  console.log(`[+] Spawning ${CONCURRENCY} concurrent client workers...`);
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(runWorker(stopTime));
  }

  // Progress update every 2 seconds
  const interval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rps = Math.round(totalRequests / (elapsed || 1));
    console.log(`[Status ${elapsed}s / ${DURATION_SECONDS}s] Total Requests: ${totalRequests} | Req/s: ${rps} | Errors: ${failedRequests}`);
  }, 2000);

  await Promise.all(workers);
  clearInterval(interval);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const throughput = (totalRequests / totalTimeSec).toFixed(2);
  const errorRate = ((failedRequests / (totalRequests || 1)) * 100).toFixed(2);

  console.log('\n===============================================================');
  console.log('                   BENCHMARK TEST REPORT                       ');
  console.log('===============================================================');
  console.log(`Total Elapsed Time:   ${totalTimeSec.toFixed(2)} seconds`);
  console.log(`Completed Requests:   ${totalRequests}`);
  console.log(`Successful Requests:  ${successfulRequests}`);
  console.log(`Failed / Denied Req:  ${failedRequests} (${errorRate}%)`);
  console.log(`Throughput:           ${throughput} req/second`);
  console.log(`Average Latency:      ${avg} ms`);
  console.log(`p50 Latency (Median): ${p50} ms`);
  console.log(`p95 Latency:          ${p95} ms`);
  console.log(`p99 Latency:          ${p99} ms`);
  console.log('===============================================================\n');

  if (errorRate > 5) {
    console.warn('[!] Notice: Elevated error rate detected. Review RTDB permission rules or network bandwidth limits.');
  } else {
    console.log('[✓] Load test completed within nominal performance parameters.');
  }
}

startLoadTest();
