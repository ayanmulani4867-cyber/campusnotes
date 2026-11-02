import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\scratch\\edge_admin_profile';
const outputDir = 'C:\\Users\\ayanm\\.gemini\\antigravity-ide\\scratch\\campusnotes\\CampusNotes_LinkedIn_Screenshots\\screenshots';
const port = 9222;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function main() {
  console.log('=== CampusNotes LinkedIn Screenshot Generator ===');
  console.log('Target viewport: 1440 x 1000');
  console.log('Output directory:', outputDir);

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
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

  // Set 1440 x 1000 viewport
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function capture(filename) {
    const shot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      const buffer = Buffer.from(shot.result.data, 'base64');
      const targetPath = path.join(outputDir, filename);
      fs.writeFileSync(targetPath, buffer);
      console.log(`[SUCCESS] Saved ${filename} (${buffer.length} bytes)`);
      return targetPath;
    }
    throw new Error(`Failed to capture ${filename}`);
  }

  // --------------------------------------------------------------------------
  // Screenshot 1 — Home Page (Production: https://campusnotes.space)
  // Branding, Curriculum Subjects, Semester Selector, Subject cards, Recent Materials
  // --------------------------------------------------------------------------
  console.log('\n[1/5] Capturing Screenshot 1: Home Page from Production (https://campusnotes.space)...');
  await sendCommand('Page.navigate', { url: 'https://campusnotes.space/' });
  await new Promise((r) => setTimeout(r, 4500));
  await sendCommand('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
  await new Promise((r) => setTimeout(r, 800));
  await capture('01-campusnotes-home.png');

  // --------------------------------------------------------------------------
  // Screenshot 2 — Semester-Wise Curriculum (Production: https://campusnotes.space/subjects)
  // Semester selector, subject names & codes, multiple cards, links to materials
  // --------------------------------------------------------------------------
  console.log('\n[2/5] Capturing Screenshot 2: Semester-Wise Curriculum from Production (/subjects)...');
  await sendCommand('Runtime.evaluate', { expression: "window.location.href = '/subjects';" });
  await new Promise((r) => setTimeout(r, 4000));
  await sendCommand('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
  await new Promise((r) => setTimeout(r, 800));
  await capture('02-semester-wise-subjects.png');

  // --------------------------------------------------------------------------
  // Screenshot 3 — Study Materials (Production: https://campusnotes.space/subjects/23cs3501_ajp)
  // Subject detail, notes/assignments/practicals, categories, view/download
  // --------------------------------------------------------------------------
  console.log('\n[3/5] Capturing Screenshot 3: Study Materials from Production (/subjects/23cs3501_ajp)...');
  await sendCommand('Runtime.evaluate', { expression: "window.location.href = '/subjects/23cs3501_ajp';" });
  await new Promise((r) => setTimeout(r, 4000));
  await sendCommand('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
  await new Promise((r) => setTimeout(r, 800));
  await capture('03-study-materials.png');

  // --------------------------------------------------------------------------
  // Screenshot 4 — Admin Dashboard (Local Authorized Session: http://localhost:5173)
  // Manage Semesters, Manage Subjects, actual lists, clear management controls
  // --------------------------------------------------------------------------
  console.log('\n[4/5] Setting up authorized admin session on local environment...');
  const devSession = JSON.stringify({
    uid: 'dev_admin_local_5',
    email: 'admin@campusnotes.internal',
    displayName: 'Administrator',
    isAuthorizedAdmin: true,
    isDevelopmentDefault: false,
    requiresPasswordChange: false,
  });

  await sendCommand('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await new Promise((r) => setTimeout(r, 1500));

  await sendCommand('Runtime.evaluate', {
    expression: `
      localStorage.setItem('cn_dev_admin_session', '${devSession}');
      sessionStorage.setItem('cn_dev_admin_session', '${devSession}');
      window.location.href = '/admin/dashboard';
    `,
  });
  await new Promise((r) => setTimeout(r, 3500));

  // Open Manage Semesters tab
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Manage Semesters'));
      if (btn) btn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));
  await capture('04-admin-management.png');

  // --------------------------------------------------------------------------
  // Screenshot 5 — Study Material Upload (Local Authorized Session)
  // Semester selection, Subject selection, title/type, file review, upload button
  // --------------------------------------------------------------------------
  console.log('\n[5/5] Navigating to Study Material Upload...');
  // Click Manage Study Materials
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const matBtn = [...document.querySelectorAll('aside nav button')].find(b => b.textContent.includes('Manage Study Materials'));
      if (matBtn) matBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Click "+ Upload Material"
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const uploadBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Upload Material'));
      if (uploadBtn) uploadBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Fill in complete, realistic form state with selected file review
  await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      // 1. Select Semester 5
      const semSelect = document.querySelector('form select');
      if (semSelect) {
        semSelect.value = 'sem_5';
        semSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 2. Select Subject & Type
      setTimeout(() => {
        const selects = document.querySelectorAll('form select');
        if (selects[1]) {
          selects[1].value = '23cs3501_ajp';
          selects[1].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (selects[2]) {
          selects[2].value = 'notes';
          selects[2].dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 100);

      function setReactInputValue(elem, val) {
        if (!elem) return;
        const proto = elem instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) {
          setter.call(elem, val);
        } else {
          elem.value = val;
        }
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Title & Description
      const titleInput = document.querySelector('form input[placeholder*="Unit 1"]') || document.querySelectorAll('form input[type="text"]')[0];
      setReactInputValue(titleInput, 'Unit 1: Multithreading & Concurrency Architecture');

      const textarea = document.querySelector('form textarea');
      setReactInputValue(textarea, 'Comprehensive lecture notes covering Java Threads, ThreadPoolExecutor, synchronized blocks, Locks, and Deadlock prevention.');

      // Unit Number
      const unitInput = document.querySelector('input[placeholder="e.g. 1"]');
      setReactInputValue(unitInput, '1');

      const yearInput = document.querySelector('input[placeholder="2026-27"]');
      setReactInputValue(yearInput, '2026-27');

      // 5. Populate file input so review state and button are enabled
      const fileInput = document.getElementById('inline-pdf-upload');
      if (fileInput) {
        const dummyContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
        const file = new File([dummyContent], '23CS3501_Unit1_Multithreading_Lecture_Notes.pdf', {
          type: 'application/pdf',
          lastModified: Date.now()
        });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));
  await capture('05-admin-material-upload.png');

  ws.close();
  edgeProcess.kill();
  console.log('\nAll 5 authentic screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
