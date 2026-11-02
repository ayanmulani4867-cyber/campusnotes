import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\scratch\\chrome_capture_profile';
const port = 9333;

async function run() {
  console.log('Spawning Chrome with remote debugging on port ' + port);
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        wsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch {
      // retry
    }
  }

  if (!wsUrl) {
    console.error('Could not get wsUrl');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome DevTools:', wsUrl);
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
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('Navigating to http://localhost:5173...');
  await sendCommand('Page.navigate', { url: 'http://localhost:5173' });
  await new Promise((r) => setTimeout(r, 3000));

  const testShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
  const outDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\scratch\\campusnotes\\scripts\\test_output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'test-home.png'), Buffer.from(testShot.result.data, 'base64'));
  console.log('Saved test-home.png');

  ws.close();
  chromeProcess.kill();
  console.log('Done test');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
