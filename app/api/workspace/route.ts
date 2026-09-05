import { getDatabase } from '@/db';
import { seedWorkspace, type Workspace } from '@/lib/tempo';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}
async function snapshot() {
  const db = getDatabase();
  await db
    .prepare(
      'INSERT OR IGNORE INTO workspaces (id,data,revision) VALUES (?,?,0)',
    )
    .bind('solo', JSON.stringify(seedWorkspace()))
    .run();
  const row = await db
    .prepare('SELECT data,revision FROM workspaces WHERE id=?')
    .bind('solo')
    .first<{ data: string; revision: number }>();
  if (!row) throw new Error('Workspace unavailable');
  return {
    workspace: JSON.parse(row.data) as Workspace,
    revision: row.revision,
  };
}
export async function GET() {
  try {
    return response(await snapshot());
  } catch {
    return response(
      { error: 'Could not load your workspace. Please try again.' },
      503,
    );
  }
}
function str(v: unknown, max = 160): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new Error('Please fill in all required fields.');
  return v.trim();
}
function number(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`Enter a number between ${min} and ${max}.`);
  return v;
}
function date(v: unknown): string {
  const s = str(v, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new Error('Choose a valid date.');
  return s;
}
function boolean(v: unknown): boolean {
  if (typeof v !== 'boolean')
    throw new Error('Choose a valid billable status.');
  return v;
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return response({ error: 'Request origin is not allowed.' }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 20000)
      return response({ error: 'Request is too large.' }, 413);
    const { action, payload: p = {}, revision } = JSON.parse(raw);
    const snap = await snapshot();
    if (revision !== snap.revision)
      return response(
        {
          error:
            'Your workspace changed in another tab. It has been refreshed; please try again.',
          ...snap,
        },
        409,
      );
    const w = snap.workspace;
    const project = (id: unknown) => {
      const item = w.projects.find((x) => x.id === id);
      if (!item) throw new Error('Choose an existing project.');
      return item;
    };
    if (action === 'saveEntry') {
      project(p.projectId);
      const entry = {
        id: p.id ? str(p.id) : crypto.randomUUID(),
        description: str(p.description),
        projectId: p.projectId,
        date: date(p.date),
        seconds: number(p.seconds, 1, 86400),
        billable: boolean(p.billable),
      };
      if (p.id) {
        if (!w.entries.some((e) => e.id === p.id))
          throw new Error('This entry no longer exists.');
        w.entries = w.entries.map((e) => (e.id === p.id ? entry : e));
      } else w.entries.unshift(entry);
    } else if (action === 'deleteEntry') {
      if (!w.entries.some((e) => e.id === p.id))
        throw new Error('This entry no longer exists.');
      w.entries = w.entries.filter((e) => e.id !== p.id);
    } else if (action === 'saveProject') {
      const old = p.id ? project(p.id) : null;
      const item = {
        id: old?.id || crypto.randomUUID(),
        name: str(p.name, 80),
        client: str(p.client, 80),
        rate: number(p.rate, 0, 100000),
        budget: number(p.budget, 1, 100000),
        color: number(p.color, 0, 3),
        archived: old?.archived || false,
      };
      if (old) w.projects = w.projects.map((x) => (x.id === old.id ? item : x));
      else w.projects.push(item);
    } else if (action === 'archiveProject') {
      const item = project(p.id);
      if (w.timer?.projectId === item.id)
        throw new Error(
          'Stop the running timer before archiving this project.',
        );
      item.archived = !item.archived;
    } else if (action === 'startTimer') {
      if (w.timer) throw new Error('A timer is already running.');
      if (project(p.projectId).archived)
        throw new Error('This project is archived.');
      w.timer = {
        description: str(p.description),
        projectId: p.projectId,
        billable: boolean(p.billable),
        date: date(p.date),
        startedAt: Date.now(),
      };
    } else if (action === 'stopTimer') {
      if (!w.timer) throw new Error('There is no running timer.');
      const { startedAt, ...entry } = w.timer;
      const seconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      w.entries.unshift({ ...entry, seconds, id: crypto.randomUUID() });
      w.timer = null;
    } else if (action === 'saveSettings') {
      w.name = str(p.name, 80);
      w.goal = number(p.goal, 1, 168);
      if (!['USD', 'CAD', 'EUR', 'GBP', 'AUD'].includes(p.currency))
        throw new Error('Choose a supported currency.');
      w.currency = p.currency;
    } else if (action === 'clearDemo') {
      if (!w.demo) throw new Error('Sample data has already been cleared.');
      if (w.timer)
        throw new Error('Stop your timer before clearing sample data.');
      w.entries = w.entries.filter((e) => !e.id.startsWith('demo-'));
      const used = new Set(w.entries.map((e) => e.projectId));
      w.projects = w.projects.filter(
        (x) =>
          !['acme', 'northstar', 'forma', 'practice'].includes(x.id) ||
          used.has(x.id),
      );
      w.demo = false;
    } else {
      throw new Error('Unknown action.');
    }
    if (w.entries.length > 20000 || w.projects.length > 1000)
      throw new Error(
        'Workspace limit reached. Export your entries before removing older work.',
      );
    const result = await getDatabase()
      .prepare(
        'UPDATE workspaces SET data=?,revision=revision+1 WHERE id=? AND revision=?',
      )
      .bind(JSON.stringify(w), 'solo', revision)
      .run();
    if (!result.meta.changes)
      return response(
        {
          error: 'Your workspace changed in another tab. Please try again.',
          ...(await snapshot()),
        },
        409,
      );
    return response({ workspace: w, revision: revision + 1 });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not save your change. Please try again.',
      },
      400,
    );
  }
}
