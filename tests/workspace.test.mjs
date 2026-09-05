import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { csvExport, seedWorkspace, duration, weekDates } from '../lib/tempo.ts';
const base = process.env.TEMPO_TEST_URL || 'http://localhost:3001';
const first = await fetch(base + '/api/workspace');
assert.equal(first.status, 200);
let s = await first.json();
const original = structuredClone(s);
await writeFile(
  '/tmp/tempo-restore.sql',
  `UPDATE workspaces SET data='${JSON.stringify(original.workspace).replaceAll("'", "''")}',revision=${original.revision} WHERE id='solo';`,
);
async function action(
  action,
  payload = {},
  status = 200,
  revision = s.revision,
) {
  const r = await fetch(base + '/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ action, payload, revision }),
  });
  const next = await r.json();
  assert.equal(r.status, status, JSON.stringify(next));
  if (next.workspace) s = next;
  return next;
}
assert.equal(s.workspace.entries.length, 11);
assert.equal(
  seedWorkspace().entries.reduce((a, e) => a + e.seconds, 0),
  32.5 * 3600,
);
assert.equal(weekDates().length, 7);
assert.equal(duration(9000), '2h 30m');
await action('saveProject', {
  name: 'QA project',
  client: 'QA client',
  rate: 225,
  budget: 10,
  color: 2,
});
const p = s.workspace.projects.at(-1);
assert.equal(p.rate, 225);
await action('saveEntry', {
  projectId: p.id,
  description: 'API test entry',
  date: '2026-09-04',
  seconds: 5400,
  billable: true,
});
const e = s.workspace.entries[0];
assert.equal((e.seconds / 3600) * p.rate, 337.5);
const reload = await (await fetch(base + '/api/workspace')).json();
assert.equal(reload.workspace.entries[0].id, e.id);
await action('saveEntry', {
  id: e.id,
  projectId: p.id,
  description: 'Updated',
  date: '2026-09-04',
  seconds: 7200,
  billable: false,
});
assert.equal(s.workspace.entries.find((x) => x.id === e.id).billable, false);
const count = s.workspace.entries.length;
await action(
  'saveEntry',
  {
    projectId: p.id,
    description: 'Invalid date',
    date: '2026-02-31',
    seconds: 10,
    billable: true,
  },
  400,
);
assert.equal(s.workspace.entries.length, count);
await action(
  'saveEntry',
  {
    projectId: p.id,
    description: 'Invalid time',
    date: '2026-09-04',
    seconds: -1,
    billable: true,
  },
  400,
);
await action(
  'saveEntry',
  {
    projectId: 'missing',
    description: 'Invalid project',
    date: '2026-09-04',
    seconds: 1,
    billable: true,
  },
  400,
);
await action(
  'saveSettings',
  { name: 'QA', goal: 40, currency: 'CAD' },
  409,
  s.revision - 1,
);
await action('startTimer', {
  projectId: p.id,
  description: 'Timer test',
  date: '2026-09-04',
  billable: true,
});
assert.ok(s.workspace.timer.startedAt);
await action(
  'startTimer',
  {
    projectId: p.id,
    description: 'Second timer',
    date: '2026-09-04',
    billable: true,
  },
  400,
);
await action('archiveProject', { id: p.id }, 400);
await action('stopTimer');
assert.equal(s.workspace.timer, null);
assert.ok(s.workspace.entries[0].seconds >= 1);
const timerEntry = s.workspace.entries[0];
await action('stopTimer', {}, 400);
await action('archiveProject', { id: p.id });
assert.ok(s.workspace.projects.find((x) => x.id === p.id).archived);
await action('archiveProject', { id: p.id });
assert.equal(s.workspace.projects.find((x) => x.id === p.id).archived, false);
await action('saveSettings', {
  name: 'QA Consultant',
  goal: 32,
  currency: 'CAD',
});
assert.equal(s.workspace.currency, 'CAD');
await action('deleteEntry', { id: e.id });
assert.ok(!s.workspace.entries.some((x) => x.id === e.id));
const csv = csvExport(
  [{ ...timerEntry, description: '=HYPERLINK("x")' }],
  [p],
  'USD',
);
assert.ok(csv.includes('"\'=HYPERLINK'));
assert.ok(csv.includes('Currency'));
const cross = await fetch(base + '/api/workspace', {
  method: 'POST',
  headers: {
    Origin: 'https://evil.example',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(cross.status, 403);
await action('clearDemo');
assert.equal(s.workspace.demo, false);
assert.ok(s.workspace.entries.some((x) => x.id === timerEntry.id));
assert.ok(!s.workspace.entries.some((x) => x.id.startsWith('demo-')));
console.log(
  'Passed: persistent CRUD, timer recovery and duplicate prevention, budget/rate calculations, archived projects, validation, stale revisions, origin checks, CSV escaping, and safe sample clearing.',
);
