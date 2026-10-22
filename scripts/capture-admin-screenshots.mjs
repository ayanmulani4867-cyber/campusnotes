import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\scratch\\edge_admin_profile';
const artifactDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\brain\\c95f6dc1-9a38-4f28-a961-f29f1e9563ba';

async function main() {
  console.log('Starting Edge with remote debugging...');
  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]);

  edgeProcess.stderr.on('data', (d) => {
    // console.log('Edge:', d.toString());
  });

  // Wait for remote debugging endpoint
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        wsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      // Retry
    }
  }

  if (!wsUrl) {
    console.error('Could not connect to Edge DevTools');
    edgeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Edge DevTools:', wsUrl);

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  let messageId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = messageId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');

  // 1. Navigate to admin login page
  console.log('Navigating to http://localhost:5173/admin/login...');
  await sendCommand('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Set dev session in localStorage & sessionStorage and navigate to dashboard
  console.log('Setting admin session credentials...');
  const devSession = JSON.stringify({
    uid: 'dev_admin_local_5',
    email: 'admin@campusnotes.internal',
    displayName: 'Administrator',
    isAuthorizedAdmin: true,
    isDevelopmentDefault: false,
    requiresPasswordChange: false,
  });

  await sendCommand('Runtime.evaluate', {
    expression: `
      localStorage.setItem('cn_dev_admin_session', '${devSession}');
      sessionStorage.setItem('cn_dev_admin_session', '${devSession}');
      window.location.href = '/admin/dashboard';
    `,
  });

  await new Promise((r) => setTimeout(r, 3000));

  // 3. Capture Desktop Screenshot
  console.log('Capturing Desktop Screenshot (1280x900)...');
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 2500));

  const desktopResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (desktopResult.result && desktopResult.result.data) {
    const desktopBuffer = Buffer.from(desktopResult.result.data, 'base64');
    fs.writeFileSync(path.join(artifactDir, 'desktop_admin.png'), desktopBuffer);
    console.log('Saved desktop_admin.png');
  }

  // 3b. Click "Manage Semesters" and capture
  console.log('Capturing Manage Semesters tab...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Manage Semesters'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1500));
  const semResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (semResult.result && semResult.result.data) {
    fs.writeFileSync(path.join(artifactDir, 'desktop_admin_semesters.png'), Buffer.from(semResult.result.data, 'base64'));
    console.log('Saved desktop_admin_semesters.png');
  }

  // 3c. Click "Manage Subjects" and capture
  console.log('Capturing Manage Subjects tab...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Manage Subjects'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2500));
  const subResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (subResult.result && subResult.result.data) {
    fs.writeFileSync(path.join(artifactDir, 'desktop_admin_subjects.png'), Buffer.from(subResult.result.data, 'base64'));
    console.log('Saved desktop_admin_subjects.png');
  }

  // 3d. Click "Manage Study Materials" and capture
  console.log('Capturing Manage Study Materials tab...');
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Manage Study Materials'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1500));
  const matResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (matResult.result && matResult.result.data) {
    fs.writeFileSync(path.join(artifactDir, 'desktop_admin_materials.png'), Buffer.from(matResult.result.data, 'base64'));
    console.log('Saved desktop_admin_materials.png');
  }

  // 4. Capture Mobile Screenshot
  console.log('Capturing Mobile Screenshot (390x844)...');
  // Reset back to dashboard first
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Dashboard'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 500));
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const mobileResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  if (mobileResult.result && mobileResult.result.data) {
    const mobileBuffer = Buffer.from(mobileResult.result.data, 'base64');
    fs.writeFileSync(path.join(artifactDir, 'mobile_admin.png'), mobileBuffer);
    console.log('Saved mobile_admin.png');
  }

  ws.close();
  edgeProcess.kill();
  console.log('Screenshots captured successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
