// Isolated localhost UI checks. Creates and removes only its own fixture user.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { signToken, hash } from '../lib/auth.ts';
import { weekDates } from '../lib/tempo.ts';
const origin = 'http://localhost:3001';
const vars = Object.fromEntries(
  (await readFile('.dev.vars', 'utf8'))
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ];
    }),
);
assert.ok(vars.AUTH_SECRET, 'Local AUTH_SECRET required');
const id = crypto.randomUUID(),
  sid = crypto.randomUUID(),
  exp = Date.now() + 3600000,
  dates = weekDates();
const projects = [
  {
    id: 'alpha',
    name: 'Brand strategy',
    client: 'Acme Studio',
    budget: 10,
    rate: 150,
    color: 0,
    archived: false,
  },
  {
    id: 'north',
    name: 'Transformation roadmap',
    client: 'Northstar',
    budget: 3,
    rate: 175,
    color: 1,
    archived: false,
  },
  {
    id: 'internal',
    name: 'Building the practice',
    client: 'Internal',
    budget: 20,
    rate: 0,
    color: 2,
    archived: false,
  },
];
const entries = [
  ['1', 'alpha', 0, 5, 'Discovery workshop', true],
  ['2', 'alpha', 1, 4, 'Stakeholder interviews', true],
  ['3', 'north', 2, 4, 'Operating model design', true],
  ['4', 'internal', 3, 2, 'Internal planning', false],
].map(([id, projectId, d, h, description, billable]) => ({
  id,
  projectId,
  date: dates[d],
  seconds: h * 3600,
  description,
  billable,
}));
const workspace = {
  projects,
  entries,
  timer: null,
  name: 'Alex Morgan',
  currency: 'USD',
  goal: 35,
  demo: false,
};
function quote(s) {
  return "'" + String(s).replaceAll("'", "''") + "'";
}
function sql(s) {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'dist/server/wrangler.json',
      '--persist-to',
      '.wrangler/state',
      '--command',
      s,
    ],
    { stdio: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
  );
}
const profile = await mkdtemp(tmpdir() + '/tempo-ux-');
let browser, ws;
let browserErrors = '';
const pending = new Map();
let seq = 0,
  sessionId;
function cdp(method, params = {}, session = sessionId) {
  const n = ++seq;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(n);
      reject(new Error('CDP timeout: ' + method));
    }, 20000);
    pending.set(n, { resolve, reject, timeout });
    ws.send(
      JSON.stringify({
        id: n,
        method,
        params,
        ...(session ? { sessionId: session } : {}),
      }),
    );
  });
}
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description || 'Browser evaluation failed',
    );
  return r.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out: ' + expression);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function tap(selector) {
  const point = await evaluate(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
  );
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y, id: 1 }],
  });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function navigate(label) {
  await click('[aria-label="Search actions and projects"]');
  await wait('!!document.querySelector("[cmdk-input]")');
  await evaluate(
    `[...document.querySelectorAll('[cmdk-item]')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
  await wait(
    `document.querySelector('.topbar strong')?.textContent===${JSON.stringify(label)}`,
  );
}
async function setInput(selector, value) {
  await evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
try {
  sql(
    `INSERT INTO users(id,email,role,token_version,created_at) VALUES(${quote(id)},${quote(id + '@ui-test.invalid')},'member',0,${Date.now()}); INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(${quote(await hash(sid))},${quote(id)},${exp}); INSERT INTO workspaces(id,data,revision) VALUES(${quote(id)},${quote(JSON.stringify(workspace))},0);`,
  );
  browser = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9334',
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  browser.stderr.on('data', (chunk) => {
    browserErrors = (browserErrors + chunk.toString()).slice(-3000);
  });
  let version;
  for (let i = 0; i < 200; i++) {
    try {
      version = await (
        await fetch('http://127.0.0.1:9334/json/version')
      ).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(version, 'Test browser startup: ' + browserErrors);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.id && pending.has(data.id)) {
      const p = pending.get(data.id);
      pending.delete(data.id);
      clearTimeout(p.timeout);
      data.error
        ? p.reject(new Error(JSON.stringify(data.error)))
        : p.resolve(data.result);
    }
  });
  const target = await cdp(
    'Target.createTarget',
    { url: 'about:blank' },
    undefined,
  );
  sessionId = (
    await cdp(
      'Target.attachToTarget',
      { targetId: target.targetId, flatten: true },
      undefined,
    )
  ).sessionId;
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const token = await signToken(vars.AUTH_SECRET, {
    kind: 'session',
    userId: id,
    tokenVersion: 0,
    sid,
    exp,
  });
  await cdp('Network.setCookie', {
    name: 'tempo_session',
    value: token,
    url: origin,
    httpOnly: true,
    sameSite: 'Strict',
  });
  await cdp('Page.navigate', { url: origin });
  await wait("document.querySelectorAll('.recent-work-item').length===3");
  assert.equal(
    await evaluate(
      "document.querySelectorAll('.attention-items>button').length",
    ),
    2,
  );
  const screenshot = async (path) => {
    const r = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(path, Buffer.from(r.data, 'base64'));
  };
  await screenshot('/tmp/tempo-overview-improved.png');
  await click('.recent-work-item');
  await wait("!!document.querySelector('.timer-card.is-running')");
  const running = await evaluate(
    "fetch('/api/workspace').then(r=>r.json()).then(s=>s.workspace.timer)",
  );
  assert.equal(running.description, 'Internal planning');
  assert.equal(running.billable, false);
  await navigate('Projects');
  await wait("!!document.querySelector('.timer-dock.visible')");
  await setInput('[aria-label="Search projects and clients"]', 'Northstar');
  await wait("document.querySelectorAll('.project-card').length===1");
  assert.ok(
    await evaluate(
      "document.querySelector('.project-card').textContent.includes('Transformation roadmap')",
    ),
  );
  await click('[aria-label="Stop running timer and save"]');
  await wait("!document.querySelector('.timer-dock')");
  const saved = await evaluate(
    "fetch('/api/workspace').then(r=>r.json()).then(s=>s.workspace)",
  );
  assert.equal(saved.timer, null);
  assert.equal(saved.entries.length, 5);
  await navigate('Time tracker');
  await click('.day-navigator button:nth-child(2)');
  await wait("document.querySelectorAll('.entry-row').length===1");
  assert.equal(
    await evaluate("document.querySelector('.entry-edit-link').textContent"),
    'Discovery workshop',
  );
  await click('.active-filter-summary button');
  await wait("document.querySelectorAll('.entry-row').length===5");
  await click('.entry-edit-link');
  await wait(
    "!!document.querySelector('[data-slot=dialog-content] input[name=description]')",
  );
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
  });
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
  });
  await wait("!document.querySelector('[data-slot=dialog-content]')");
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'k',
    code: 'KeyK',
    modifiers: 4,
  });
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'k',
    code: 'KeyK',
    modifiers: 4,
  });
  await wait("!!document.querySelector('[cmdk-input]')");
  await wait('document.activeElement?.hasAttribute("cmdk-input")');
  await setInput('[cmdk-input]', 'Northstar');
  await wait("document.querySelectorAll('[cmdk-item]').length===1");
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
  });
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
  });
  await wait("document.querySelectorAll('.entry-row').length===1");
  assert.equal(
    await evaluate("document.querySelector('.entry-edit-link').textContent"),
    'Operating model design',
  );
  await navigate('Time tracker');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate('window.scrollTo(0,0)');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(
    await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),
    true,
  );
  assert.equal(
    await evaluate(
      `(()=>{const p=document.querySelector('.timer-project').getBoundingClientRect();const b=document.querySelector('label[for="timer-billable"]').getBoundingClientRect();return b.top>=p.bottom||b.left>=p.right})()`,
    ),
    true,
    'Project picker and billable switch do not overlap',
  );
  await screenshot('/tmp/tempo-timesheet-mobile.png');
  await tap('[aria-label="Search actions and projects"]');
  await wait('!!document.querySelector("[cmdk-input]")');
  await wait('document.activeElement?.hasAttribute("cmdk-input")');
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
  });
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
  });
  await wait('!document.querySelector("[cmdk-input]")');
  await click('.recent-work-item');
  await wait("!!document.querySelector('.timer-card.is-running')");
  await evaluate('window.scrollTo(0,document.body.scrollHeight)');
  await wait("!!document.querySelector('.timer-dock.visible')");
  assert.equal(
    await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),
    true,
  );
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(
    await evaluate(
      "document.querySelector('.timer-dock').getBoundingClientRect().bottom<=innerHeight",
    ),
    true,
  );
  await screenshot('/tmp/tempo-timer-mobile.png');
  await click('[aria-label="Stop running timer and save"]');
  await wait("!document.querySelector('.timer-dock')");
  console.log(
    'PASS: recent-work timer preserves billing, project search, persistent stop/save, day filtering/reset, keyboard entry editing, command menu search/Enter, mobile layout, sticky timer dock.',
  );
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      await cdp('Browser.close', {}, undefined);
    } catch {}
    ws.close();
  }
  if (browser) browser.kill();
  sql(
    `DELETE FROM workspaces WHERE id=${quote(id)}; DELETE FROM users WHERE id=${quote(id)};`,
  );
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
