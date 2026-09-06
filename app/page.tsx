'use client';
import Link from 'next/link';
import { AuthScreen, type CurrentUser } from '@/components/auth-screen';
import { AdminPanel } from '@/components/admin-panel';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Clock3,
  LayoutDashboard,
  FolderKanban,
  ChartNoAxesCombined,
  ArrowUpRight,
  Plus,
  Play,
  Square,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Settings2,
  Download,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  Check,
  CircleAlert,
  Archive,
  RotateCcw,
  Coffee,
  LogOut,
  Printer,
  FileText,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  dateKey,
  weekDates,
  duration,
  clockTime,
  money,
  csvExport,
  type Workspace,
  type Snapshot,
  type Project,
  type Entry,
} from '@/lib/tempo';
const navigation = [
  { Icon: LayoutDashboard, label: 'Overview' },
  { Icon: Clock3, label: 'Time tracker' },
  { Icon: FolderKanban, label: 'Projects' },
  { Icon: ChartNoAxesCombined, label: 'Reports' },
];
type Modal =
  | { type: 'entry'; entry?: Entry }
  | { type: 'project'; project?: Project }
  | { type: 'settings' }
  | null;
function Picker({
  value,
  onChange,
  items,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function TimerClock({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span>{clockTime(startedAt ? (now - startedAt) / 1000 : 0)}</span>;
}
function Blank({ title, text }: { title: string; text: string }) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <Coffee size={25} />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function EntryForm({
  entry,
  projects,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: Entry;
  projects: Project[];
  busy: boolean;
  onSave: (p: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [projectId, setProject] = useState(
    entry?.projectId || projects.find((p) => !p.archived)?.id || '',
  );
  const [billable, setBillable] = useState(entry?.billable ?? true);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSave({
          id: entry?.id,
          description: f.get('description'),
          projectId,
          date: f.get('date'),
          seconds:
            Number(f.get('hours')) * 3600 + Number(f.get('minutes')) * 60,
          billable,
        });
      }}
    >
      <label>
        What did you work on?
        <input
          name="description"
          required
          maxLength={160}
          placeholder="e.g. Discovery workshop"
          defaultValue={entry?.description}
        />
      </label>
      <div className="form-field">
        <span>Project</span>
        <Picker
          label="Project"
          value={projectId}
          onChange={setProject}
          items={projects
            .filter((p) => !p.archived || p.id === entry?.projectId)
            .map((p) => ({ value: p.id, label: `${p.name} · ${p.client}` }))}
        />
      </div>
      <label>
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={entry?.date || dateKey(new Date())}
        />
      </label>
      <div className="form-row">
        <label>
          Hours
          <input
            name="hours"
            type="number"
            min="0"
            max="24"
            required
            defaultValue={entry ? Math.floor(entry.seconds / 3600) : 1}
          />
        </label>
        <label>
          Minutes
          <input
            name="minutes"
            type="number"
            min="0"
            max="59"
            step="0.01"
            required
            defaultValue={
              entry ? Number(((entry.seconds % 3600) / 60).toFixed(2)) : 0
            }
          />
        </label>
      </div>
      <div className="switch-line">
        <span>
          Billable time<small>Include this time in your billable value.</small>
        </span>
        <Switch
          checked={billable}
          onCheckedChange={setBillable}
          aria-label="Billable time"
        />
      </div>
      <div className="form-actions">
        {entry && onDelete && (
          <button
            type="button"
            className="button delete-entry"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 size={15} /> Delete entry
          </button>
        )}
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !projectId}>
          {busy ? 'Saving…' : entry ? 'Save changes' : 'Save entry'}
        </button>
      </div>
    </form>
  );
}
function ProjectForm({
  project,
  busy,
  onSave,
  onCancel,
}: {
  project?: Project;
  busy: boolean;
  onSave: (p: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [color, setColor] = useState(String(project?.color ?? 0));
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSave({
          id: project?.id,
          name: f.get('name'),
          client: f.get('client'),
          rate: Number(f.get('rate')),
          budget: Number(f.get('budget')),
          color: Number(color),
        });
      }}
    >
      <label>
        Project name
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Growth strategy"
          defaultValue={project?.name}
        />
      </label>
      <label>
        Client
        <input
          name="client"
          required
          maxLength={80}
          placeholder="e.g. Northstar"
          defaultValue={project?.client}
        />
      </label>
      <div className="form-row">
        <label>
          Hourly rate
          <input
            name="rate"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            required
            defaultValue={project?.rate ?? 150}
          />
        </label>
        <label>
          Time budget (hours)
          <input
            name="budget"
            type="number"
            min="1"
            max="100000"
            step="0.5"
            required
            defaultValue={project?.budget ?? 40}
          />
        </label>
      </div>
      <div className="form-field">
        <span>Project color</span>
        <Picker
          label="Project color"
          value={color}
          onChange={setColor}
          items={[
            { value: '0', label: 'Iris blue' },
            { value: '1', label: 'Terracotta' },
            { value: '2', label: 'Forest green' },
            { value: '3', label: 'Orchid' },
          ]}
        />
      </div>
      {project && (
        <p className="form-note">
          Changing the rate also updates the value of this project’s existing
          entries.
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : project ? 'Save project' : 'Create project'}
        </button>
      </div>
    </form>
  );
}
type InvoiceRequest = {
  client: string;
  from: string;
  to: string;
  number: string;
  notes: string;
};
function InvoiceSetup({
  clients,
  onCreate,
}: {
  clients: string[];
  onCreate: (request: InvoiceRequest) => void;
}) {
  const today = new Date();
  const [client, setClient] = useState(clients[0] || '');
  const [from, setFrom] = useState(
    dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
  );
  const [to, setTo] = useState(dateKey(today));
  const [number, setNumber] = useState(
    `INV-${dateKey(today).replaceAll('-', '')}`,
  );
  const [notes, setNotes] = useState('');
  if (!clients.length)
    return (
      <p className="form-note">
        Add a project with a client first — an invoice is billed to a client.
      </p>
    );
  return (
    <div className="invoice-setup">
      <div className="invoice-setup-grid">
        <div className="form-field">
          <span>Client</span>
          <Picker
            label="Client"
            value={client}
            onChange={setClient}
            items={clients.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Invoice no.
          <input
            value={number}
            maxLength={40}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
      </div>
      <label className="invoice-setup-notes">
        Notes / payment terms (optional)
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          placeholder="e.g. Payment due within 14 days. Bank transfer to…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button
        className="button primary"
        disabled={!client}
        onClick={() => onCreate({ client, from, to, number, notes })}
      >
        <FileText size={16} /> Preview invoice
      </button>
    </div>
  );
}
function Invoice({
  workspace,
  projects,
  entries,
  request,
  onClose,
}: {
  workspace: Workspace;
  projects: Project[];
  entries: Entry[];
  request: InvoiceRequest;
  onClose: () => void;
}) {
  const { client, from, to, number, notes } = request;
  const currency = workspace.currency;
  const money2 = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  const clientProjectIds = new Set(
    projects.filter((p) => p.client === client).map((p) => p.id),
  );
  const lines = entries
    .filter(
      (e) =>
        clientProjectIds.has(e.projectId) && e.date >= from && e.date <= to,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const rateOf = (id: string) => projects.find((p) => p.id === id)?.rate || 0;
  const nameOf = (id: string) => projects.find((p) => p.id === id)?.name || '';
  const amountOf = (e: Entry) =>
    e.billable ? (e.seconds / 3600) * rateOf(e.projectId) : 0;
  const totalDue = lines.reduce((sum, e) => sum + amountOf(e), 0);
  const totalHours = lines.reduce((sum, e) => sum + e.seconds / 3600, 0);
  const billableHours = lines
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + e.seconds / 3600, 0);
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return (
    <div className="invoice-overlay">
      <div className="invoice-actions">
        <button className="button" onClick={onClose}>
          Close
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>
      <div className="invoice-sheet">
        <header className="invoice-head">
          <div>
            <span className="invoice-mark">tempo</span>
            <h1>Invoice</h1>
          </div>
          <div className="invoice-id">
            <div>
              <span>Invoice no.</span>
              <strong>{number || '—'}</strong>
            </div>
            <div>
              <span>Issued</span>
              <strong>{fmt(dateKey(new Date()))}</strong>
            </div>
          </div>
        </header>
        <div className="invoice-parties">
          <div>
            <span>From</span>
            <strong>{workspace.name}</strong>
            <p>Independent consultant</p>
          </div>
          <div>
            <span>Bill to</span>
            <strong>{client}</strong>
            <p>
              {fmt(from)} – {fmt(to)}
            </p>
          </div>
        </div>
        {lines.length ? (
          <table className="invoice-lines">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Hours</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{fmt(e.date)}</td>
                  <td>
                    {e.description}
                    <small>{nameOf(e.projectId)}</small>
                    {!e.billable && (
                      <span className="invoice-nb">Non-billable</span>
                    )}
                  </td>
                  <td className="num">{(e.seconds / 3600).toFixed(2)}</td>
                  <td className="num">
                    {e.billable ? money2(rateOf(e.projectId)) : '—'}
                  </td>
                  <td className="num">
                    {e.billable ? money2(amountOf(e)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="invoice-empty">
            No time recorded for {client} between {fmt(from)} and {fmt(to)}.
          </p>
        )}
        <div className="invoice-summary">
          <span className="invoice-summary-meta">
            {billableHours.toFixed(2)} billable hours
            {totalHours > billableHours
              ? ` · ${(totalHours - billableHours).toFixed(2)}h non-billable, not charged`
              : ''}
          </span>
          <div className="invoice-total-row">
            <span>Total due</span>
            <strong>{money2(totalDue)}</strong>
          </div>
        </div>
        {notes.trim() && <p className="invoice-notes">{notes}</p>}
      </div>
    </div>
  );
}
export default function Home() {
  const [view, setView] = useState('Overview');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const timerInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const authEpoch = useRef(0);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [invoice, setInvoice] = useState<InvoiceRequest | null>(null);
  const [confirm, setConfirm] = useState<{
    action: string;
    payload: Record<string, unknown>;
    title: string;
    text: string;
  } | null>(null);
  const [week, setWeek] = useState(0);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [billFilter, setBillFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [description, setDescription] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const apply = useCallback((s: Snapshot) => {
    snapshotRef.current = s;
    setSnapshot(s);
  }, []);
  const load = useCallback(async () => {
    const epoch=authEpoch.current;
    try {
      const me = await fetch('/api/auth/me', { cache: 'no-store' });
      if(epoch!==authEpoch.current)return;
      if (me.status === 401) {
        snapshotRef.current = null;
        setSnapshot(null);
        setUser(null);
        setAuthRequired(true);
        return;
      }
      if (!me.ok) {
        const problem = (await me.json()) as { error?: string };
        throw new Error(problem.error || 'Could not sign in.');
      }
      const currentUser = (await me.json()) as CurrentUser;
      setUser(currentUser);
      const r = await fetch('/api/workspace', { cache: 'no-store' });
      if(epoch!==authEpoch.current)return;
      if (r.status === 401) {
        snapshotRef.current=null;setSnapshot(null);setUser(null);
        setAuthRequired(true);
        return;
      }
      const s = (await r.json()) as Snapshot & { error?: string };
      if(epoch!==authEpoch.current)return;
      if (!r.ok) throw new Error(s.error || 'Could not load your workspace.');
      setAuthRequired(false);
      if (!lock.current) apply(s);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load your workspace.',
      );
    }
  }, [apply]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [load]);
  const mutate = useCallback(
    async (
      action: string,
      payload: Record<string, unknown> = {},
    ): Promise<boolean> => {
      if (lock.current || !snapshotRef.current) return false;
      lock.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const r = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            payload,
            revision: snapshotRef.current.revision,
          }),
        });
        const s = (await r.json()) as Snapshot & {
          error?: string;
          authRequired?: boolean;
        };
        if (r.status === 401 || s.authRequired) {
          snapshotRef.current = null;
          setSnapshot(null);
          setUser(null);
          setAuthRequired(true);
        }
        if (s.workspace) apply(s);
        if (!r.ok) throw new Error(s.error || 'Could not save your change.');
        setNotice(
          action === 'stopTimer'
            ? 'Time saved. Nice work.'
            : action === 'clearDemo'
              ? 'Your workspace is ready for a fresh start.'
              : 'All changes saved.',
        );
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not save. Please retry.',
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [apply],
  );
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    const tools = [
      {
        name: 'read_tempo_workspace',
        description:
          'Read saved projects, time entries, and the running timer in this private consultant workspace.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => snapshotRef.current,
      },
      {
        name: 'log_tempo_time',
        description:
          'Save a completed time entry and update the workspace. Seconds must be between 1 and 86400.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            projectId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            seconds: { type: 'number' },
            billable: { type: 'boolean' },
          },
          required: ['description', 'projectId', 'date', 'seconds', 'billable'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          if (!input || typeof input !== 'object')
            throw new Error('An entry is required.');
          const ok = await mutate(
            'saveEntry',
            input as Record<string, unknown>,
          );
          if (!ok)
            throw new Error(
              'Entry was not saved. Check the visible workspace error.',
            );
          return { saved: true, revision: snapshotRef.current?.revision };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, [mutate]);
  const w = snapshot?.workspace;
  const projects = w?.projects || [];
  const entries = w?.entries || [];
  const active = projects.filter((p) => !p.archived);
  const clients = [...new Set(projects.map((p) => p.client))].sort();
  const dates = weekDates(week);
  const periodEntries = entries.filter(
    (e) => e.date >= dates[0] && e.date <= dates[6],
  );
  const visibleEntries = periodEntries
    .filter(
      (e) =>
        (projectFilter === 'all' || e.projectId === projectFilter) &&
        (billFilter === 'all' || e.billable === (billFilter === 'billable')) &&
        `${e.description} ${projects.find((p) => p.id === e.projectId)?.client} ${projects.find((p) => p.id === e.projectId)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = periodEntries.reduce((a, e) => a + e.seconds, 0);
  const billable = periodEntries
    .filter((e) => e.billable)
    .reduce((a, e) => a + e.seconds, 0);
  const value = periodEntries.reduce(
    (a, e) =>
      a +
      (e.billable
        ? (e.seconds / 3600) *
          (projects.find((p) => p.id === e.projectId)?.rate || 0)
        : 0),
    0,
  );
  const utilization = total ? Math.round((billable / total) * 100) : 0;
  const selectedProject = timerProject || active[0]?.id || '';
  const openEntry = () => {
    setError('');
    if (!active.length) {
      setModal({ type: 'project' });
      setNotice('Create your first project, then log some time.');
    } else setModal({ type: 'entry' });
  };
  const go = (next: string) => {
    setView(next);
    setSearch('');
    setProjectFilter('all');
    setBillFilter('all');
  };
  const download = () => {
    const blob = new Blob(
      ['\uFEFF' + csvExport(visibleEntries, projects, w?.currency || 'USD')],
      { type: 'text/csv;charset=utf-8;' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempo-timesheet-${dates[0]}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Exported ${visibleEntries.length} entries.`);
  };
  const totalsFor = (id: string, period = false) =>
    (period ? periodEntries : entries)
      .filter((e) => e.projectId === id)
      .reduce((a, e) => a + e.seconds / 3600, 0);
  const weekLabel = `${new Date(dates[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(dates[6] + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const periodControl = (
    <div className="week-control">
      <button aria-label="Previous week" onClick={() => setWeek((v) => v - 1)}>
        <ChevronLeft size={16} />
      </button>
      <button
        className="week-label"
        title="Return to current week"
        onClick={() => setWeek(0)}
      >
        {week === 0 ? 'This week' : weekLabel}
      </button>
      <button aria-label="Next week" onClick={() => setWeek((v) => v + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
  const table = (rows: Entry[]) => (
    <>
      {rows.length ? (
        <Table className="entry-table">
          <TableHeader>
            <TableRow>
              <TableHead>Work & project</TableHead>
              <TableHead className="col-date">Date</TableHead>
              <TableHead className="col-type">Type</TableHead>
              <TableHead className="right col-duration">Duration</TableHead>
              <TableHead className="right col-value">Value</TableHead>
              <TableHead className="col-actions">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const p = projects.find((p) => p.id === e.projectId);
              return (
                <TableRow
                  key={e.id}
                  className="entry-row"
                  onClick={() => {
                    setError('');
                    setModal({ type: 'entry', entry: e });
                  }}
                >
                  <TableCell>
                    <div className="entry-work">
                      <span className={`project-icon color-${p?.color || 0}`}>
                        {p?.client[0]}
                      </span>
                      <div>
                        <strong>{e.description}</strong>
                        <small>
                          <span className={`dot color-${p?.color || 0}`} />
                          {p?.name} <span className="separator">/</span>{' '}
                          {p?.client}
                        </small>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="muted">
                    {new Date(e.date + 'T12:00:00').toLocaleDateString(
                      'en-US',
                      { month: 'short', day: 'numeric' },
                    )}
                  </TableCell>
                  <TableCell className="col-type">
                    <span className={e.billable ? 'billable' : 'nonbillable'}>
                      {e.billable ? 'Billable' : 'Non-billable'}
                    </span>
                  </TableCell>
                  <TableCell className="right entry-duration">
                    {duration(e.seconds)}
                  </TableCell>
                  <TableCell className="right muted col-value">
                    {e.billable
                      ? money((e.seconds / 3600) * (p?.rate || 0), w?.currency)
                      : '—'}
                  </TableCell>
                  <TableCell className="col-actions">
                    <div className="row-actions">
                      <button
                        aria-label={`Edit ${e.description}`}
                        title="Edit entry"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setError('');
                          setModal({ type: 'entry', entry: e });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="danger"
                        aria-label={`Delete ${e.description}`}
                        title="Delete entry"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setConfirm({
                            action: 'deleteEntry',
                            payload: { id: e.id },
                            title: 'Delete this entry?',
                            text: `“${e.description}” will be permanently removed from your timesheet.`,
                          });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <Blank
          title="A clear page. A fresh start."
          text="No entries match this view. Log time or try another week or filter."
        />
      )}
    </>
  );
  if (authRequired)
    return (
      <AuthScreen
        onUnlock={(currentUser) => {
          authEpoch.current++;setDescription('');setTimerProject('');setTimerBillable(true);setSearch('');setProjectFilter('all');setBillFilter('all');setView('Overview');setWeek(0);setInvoice(null);setModal(null);setConfirm(null);setNotice('');setError('');setAdminOpen(false);
          setUser(currentUser);
          setAuthRequired(false);
          void load();
        }}
      />
    );
  return (
    <SidebarProvider style={{ '--sidebar-width': '232px' } as CSSProperties}>
      <Sidebar>
        <SidebarHeader>
          <Link className="brand" href="/">
            tempo
          </Link>
          <div className="workspace">
            <span className="workspace-icon">S</span>
            <div>
              Solo workspace<small>Independent consultant</small>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <span className="nav-label">WORKSPACE</span>
          <SidebarMenu>
            {navigation.map(({ Icon, label }) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  className="nav-item"
                  isActive={view === label}
                  onClick={() => go(label)}
                >
                  <Icon />
                  <span>{label}</span>
                  {label === 'Time tracker' && w?.timer && (
                    <span className="live-dot" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <Sparkles size={19} />
            <h3>Good work takes time.</h3>
            <p>Make sure yours counts.</p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          {user?.role === 'owner' && (
            <button
              className="sidebar-logout"
              onClick={() => setAdminOpen(true)}
            >
              <Settings2 size={16} />
              <span>Manage members</span>
            </button>
          )}
          <button
            className="profile"
            onClick={() => {
              setError('');
              setModal({ type: 'settings' });
            }}
          >
            <span className="avatar">
              {(w?.name || 'Solo consultant')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              {w?.name || 'Your workspace'}
              <small>Personal workspace</small>
            </span>
            <Settings2 size={17} />
          </button>
          {user && (
            <button
              className="sidebar-logout"
              disabled={busy}
              onClick={async () => {
                authEpoch.current++;
                try {
                  const r = await fetch('/api/auth/logout', { method: 'POST' });
                  if (!r.ok) throw new Error('Logout failed.');
                } catch {
                  setError('Could not log out. Please try again.');
                  return;
                }
                setUser(null);
                setAdminOpen(false);
                setModal(null);
                setInvoice(null);
                setConfirm(null);
                snapshotRef.current = null;
                setSnapshot(null);
                setAuthRequired(true);
              }}
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          )}
        </SidebarFooter>
      </Sidebar>
      <main className="main">
        <header className="topbar">
          <div>
            <SidebarTrigger className="mobile-menu" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <span className="saved">
            <i />
            {busy ? 'Saving…' : w ? 'Saved to your workspace' : 'Connecting…'}
          </span>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {view === 'Overview'
                  ? 'YOUR WORK, AT A GLANCE'
                  : view === 'Time tracker'
                    ? 'A PLACE FOR EVERY HOUR'
                    : view === 'Projects'
                      ? 'THE BIGGER PICTURE'
                      : 'KNOW THE VALUE OF YOUR TIME'}
              </div>
              <h1>
                {view === 'Overview'
                  ? 'A little focus. A lot of progress.'
                  : view === 'Time tracker'
                    ? 'Make every hour count.'
                    : view === 'Projects'
                      ? 'Good work, well managed.'
                      : 'Your time. The full picture.'}
              </h1>
              <p>
                {view === 'Overview'
                  ? 'Make room for your best work. We’ll keep track of the time.'
                  : view === 'Time tracker'
                    ? 'Find your flow. Keep a record of the work that matters.'
                    : view === 'Projects'
                      ? 'Keep your clients, budgets, and next big things in sync.'
                      : 'Turn the hours you put in into insights you can act on.'}
              </p>
            </div>
            <button
              className="button"
              disabled={!w}
              onClick={
                view === 'Projects'
                  ? () => {
                      setError('');
                      setModal({ type: 'project' });
                    }
                  : openEntry
              }
            >
              <Plus size={17} />
              {view === 'Projects' ? 'New project' : 'Log time'}
            </button>
          </section>
          {error && !modal && !confirm && (
            <div className="feedback error" role="alert">
              <CircleAlert size={17} />
              {error}
              <button
                onClick={() => {
                  setError('');
                  void load();
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <output className="feedback success">
              <Check size={15} />
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                ×
              </button>
            </output>
          )}
          {!w ? (
            <section className="panel">
              <Blank
                title={error ? 'Let’s reconnect.' : 'Opening your workspace…'}
                text={
                  error
                    ? 'Your saved work is still safe. Use Retry to reconnect.'
                    : 'Getting your projects and time entries ready.'
                }
              />
            </section>
          ) : (
            <>
              {w.projects.length === 0 && (
                <section className="onboarding-guide">
                  <div className="onboarding-header">
                    <span className="eyebrow">QUICK START GUIDE</span>
                    <h2>Welcome to your private workspace</h2>
                    <p>Here’s how to get up and running in 3 quick steps:</p>
                  </div>
                  <div className="onboarding-steps">
                    <div className="onboarding-step">
                      <span className="step-num">1</span>
                      <div>
                        <strong>Create a project</strong>
                        <p>Set up a client name, hourly rate, and color tag.</p>
                        <button
                          className="button primary sm"
                          onClick={() => setModal({ type: 'project' })}
                        >
                          <Plus size={14} /> Add project
                        </button>
                      </div>
                    </div>
                    <div className="onboarding-step">
                      <span className="step-num">2</span>
                      <div>
                        <strong>Track your hours</strong>
                        <p>Use the live timer or log completed sessions manually.</p>
                      </div>
                    </div>
                    <div className="onboarding-step">
                      <span className="step-num">3</span>
                      <div>
                        <strong>Use as an app (PWA)</strong>
                        <p>On iOS, tap Share → “Add to Home Screen” for instant access.</p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
              {(view === 'Overview' || view === 'Time tracker') && (
                <section
                  className={`timer-card ${w.timer ? 'is-running' : ''}`}
                >
                  <div className="timer-copy">
                    <span className="eyebrow">
                      {w.timer ? (
                        <>
                          <span className="live-dot" /> YOU’RE IN YOUR FLOW
                        </>
                      ) : (
                        'LET’S MAKE TIME COUNT'
                      )}
                    </span>
                    <input
                      ref={timerInput}
                      className="timer-description"
                      aria-label="What are you working on?"
                      maxLength={160}
                      placeholder="What are you working on?"
                      value={w.timer?.description ?? description}
                      disabled={!!w.timer || busy}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !w.timer && description.trim())
                          void mutate('startTimer', {
                            description,
                            projectId: selectedProject,
                            billable: timerBillable,
                            date: dateKey(new Date()),
                          });
                      }}
                    />
                    <div className="timer-options">
                      {active.length ? (
                        <div className="timer-project">
                          <FolderKanban size={15} aria-hidden />
                          <span className="timer-project-label">Project</span>
                          <Picker
                            label="Select a project"
                            value={w.timer?.projectId || selectedProject}
                            disabled={!!w.timer || busy}
                            onChange={setTimerProject}
                            items={active.map((p) => ({
                              value: p.id,
                              label: `${p.name} · ${p.client}`,
                            }))}
                          />
                        </div>
                      ) : (
                        <button
                          className="timer-new"
                          onClick={() => setModal({ type: 'project' })}
                        >
                          <Plus size={14} /> Create your first project
                        </button>
                      )}
                      <span className="timer-option-divider" />
                      <label htmlFor="timer-billable">
                        <Switch
                          id="timer-billable"
                          aria-label="Timer is billable"
                          checked={w.timer?.billable ?? timerBillable}
                          disabled={!!w.timer || busy}
                          onCheckedChange={setTimerBillable}
                        />{' '}
                        Billable
                      </label>
                    </div>
                  </div>
                  <div className="timer-control">
                    <TimerClock startedAt={w.timer?.startedAt ?? null} />
                    <button
                      disabled={busy}
                      aria-label={
                        w.timer ? 'Stop timer and save entry' : 'Start timer'
                      }
                      title={w.timer ? 'Stop & save' : 'Start timer'}
                      onClick={async () => {
                        if (w.timer) {
                          if (await mutate('stopTimer')) setDescription('');
                        } else if (!selectedProject) {
                          setModal({ type: 'project' });
                        } else if (!description.trim()) {
                          setError(
                            'Type what you’re working on in the box, then press play.',
                          );
                          timerInput.current?.focus();
                        } else
                          await mutate('startTimer', {
                            description,
                            projectId: selectedProject,
                            billable: timerBillable,
                            date: dateKey(new Date()),
                          });
                      }}
                    >
                      {w.timer ? (
                        <Square size={19} fill="currentColor" />
                      ) : (
                        <Play size={22} fill="currentColor" />
                      )}
                    </button>
                  </div>
                </section>
              )}
              {view !== 'Projects' && (
                <>
                  <div className="period-row">
                    <span>
                      {weekLabel}
                      {w.demo && (
                        <span className="sample-label">Sample workspace</span>
                      )}
                    </span>
                    {periodControl}
                  </div>
                  <section className="stats">
                    {[
                      [
                        'Hours this week',
                        (total / 3600).toFixed(1),
                        `${Math.round((total / 3600 / w.goal) * 100)}% of your ${w.goal}-hour goal`,
                      ],
                      [
                        'Billable value',
                        money(value, w.currency),
                        `${duration(billable)} of billable work · ${w.currency}`,
                      ],
                      [
                        'Billable utilization',
                        `${utilization}%`,
                        `${duration(total - billable)} non-billable`,
                      ],
                      [
                        'Active projects',
                        String(active.length),
                        `${new Set(active.map((p) => p.client)).size} clients in your orbit`,
                      ],
                    ].map(([label, v, sub], i) => (
                      <div className="stat" key={label}>
                        <span>
                          {i === 0 && week !== 0 ? 'Hours this week' : label}
                          <ArrowUpRight size={16} />
                        </span>
                        <strong>{v}</strong>
                        <small>{sub}</small>
                        {i === 0 && (
                          <Progress
                            className="goal-progress"
                            value={Math.min(100, (total / 3600 / w.goal) * 100)}
                            aria-label="Weekly hours goal"
                          />
                        )}
                      </div>
                    ))}
                  </section>
                </>
              )}
              {view === 'Overview' && (
                <>
                  <div className="overview-grid">
                    <section className="panel week-panel">
                      <div className="section-heading">
                        <h2>Your week in rhythm</h2>
                        <div className="legend">
                          <i /> Billable <i className="light" /> Other
                        </div>
                      </div>
                      <div className="chart-with-axis">
                        <div className="chart-axis">
                          <span>
                            {Math.max(
                              8,
                              ...dates.map((d) =>
                                periodEntries
                                  .filter((e) => e.date === d)
                                  .reduce((a, e) => a + e.seconds / 3600, 0),
                              ),
                            ).toFixed(0)}
                            h
                          </span>
                          <span>0h</span>
                        </div>
                        <div className="chart">
                          {dates.map((d, i) => {
                            const day = periodEntries.filter(
                              (e) => e.date === d,
                            );
                            const h = day.reduce(
                              (a, e) => a + e.seconds / 3600,
                              0,
                            );
                            const bh = day
                              .filter((e) => e.billable)
                              .reduce((a, e) => a + e.seconds / 3600, 0);
                            const max = Math.max(
                              8,
                              ...dates.map((d) =>
                                periodEntries
                                  .filter((e) => e.date === d)
                                  .reduce((a, e) => a + e.seconds / 3600, 0),
                              ),
                            );
                            return (
                              <div className="chart-col" key={d}>
                                <span>{h ? `${h.toFixed(1)}h` : ''}</span>
                                <div
                                  className={`bar ${d === dateKey(new Date()) ? 'today' : ''}`}
                                  style={{ height: `${(h / max) * 145}px` }}
                                  title={`${d}: ${h.toFixed(1)} hours, ${bh.toFixed(1)} billable`}
                                >
                                  <div
                                    className="bar-other"
                                    style={{
                                      height: `${h ? ((h - bh) / h) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                                <small>
                                  {
                                    [
                                      'Mon',
                                      'Tue',
                                      'Wed',
                                      'Thu',
                                      'Fri',
                                      'Sat',
                                      'Sun',
                                    ][i]
                                  }
                                  <span
                                    className={
                                      d === dateKey(new Date())
                                        ? 'today-date'
                                        : ''
                                    }
                                  >
                                    {Number(d.slice(-2))}
                                  </span>
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="chart-footer">
                        <span>
                          {total / 3600 >= w.goal
                            ? 'Weekly goal reached. Well done.'
                            : `${Math.max(0, w.goal - total / 3600).toFixed(1)} hours to your weekly goal`}
                        </span>
                        <strong>
                          {(total / 3600).toFixed(1)} / {w.goal}h
                        </strong>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Project pulse</h2>
                        <button
                          className="icon-button"
                          aria-label="View all projects"
                          onClick={() => go('Projects')}
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                      {active.length ? (
                        active.slice(0, 3).map((p) => {
                          const h = totalsFor(p.id);
                          const pct = Math.round((h / p.budget) * 100);
                          return (
                            <button
                              className="project-pulse"
                              key={p.id}
                              onClick={() => {
                                go('Time tracker');
                                setProjectFilter(p.id);
                              }}
                            >
                              <span className={`project-icon color-${p.color}`}>
                                {p.client[0]}
                              </span>
                              <div>
                                <strong>{p.name}</strong>
                                <small>
                                  {p.client}{' '}
                                  <span>
                                    · {h.toFixed(1)} / {p.budget}h
                                  </span>
                                </small>
                                <Progress
                                  className={`project-progress color-${p.color}`}
                                  value={Math.min(pct, 100)}
                                  aria-label={`${p.name} budget used`}
                                />
                              </div>
                              <span
                                className={pct >= 90 ? 'budget-warning' : ''}
                              >
                                {pct}%
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <Blank
                          title="Your next chapter starts here."
                          text="Add a project to keep an eye on its hours and budget."
                        />
                      )}
                      <div className="project-footer">
                        <span>
                          <i /> Budgets include all recorded time
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="panel entries-panel">
                    <div className="section-heading">
                      <h2>
                        Recent entries{' '}
                        <span className="count">{periodEntries.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => go('Time tracker')}
                      >
                        View all entries <ArrowRight size={14} />
                      </button>
                    </div>
                    {table(
                      [...periodEntries]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 4),
                    )}
                  </section>
                </>
              )}
              {view === 'Time tracker' && (
                <section className="panel entries-panel">
                  <div className="section-heading">
                    <h2>
                      Your timesheet{' '}
                      <span className="count">
                        {visibleEntries.length} ENTRIES
                      </span>
                    </h2>
                    <button
                      className="button"
                      disabled={!visibleEntries.length}
                      onClick={download}
                    >
                      <Download size={15} /> Export CSV
                    </button>
                  </div>
                  <div className="filters">
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        aria-label="Search time entries"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search your work…"
                      />
                    </div>
                    <Picker
                      label="Filter by project"
                      value={projectFilter}
                      onChange={setProjectFilter}
                      items={[
                        { value: 'all', label: 'All projects' },
                        ...projects.map((p) => ({
                          value: p.id,
                          label: p.name,
                        })),
                      ]}
                    />
                    <Picker
                      label="Filter billable status"
                      value={billFilter}
                      onChange={setBillFilter}
                      items={[
                        { value: 'all', label: 'All time' },
                        { value: 'billable', label: 'Billable' },
                        { value: 'nonbillable', label: 'Non-billable' },
                      ]}
                    />
                  </div>
                  {table(visibleEntries)}
                  <div className="table-footer">
                    <span>{visibleEntries.length} entries in this view</span>
                    <strong>
                      {duration(
                        visibleEntries.reduce((a, e) => a + e.seconds, 0),
                      )}{' '}
                      total
                    </strong>
                  </div>
                </section>
              )}
              {view === 'Projects' && (
                <>
                  <div className="project-page-tools">
                    <span>
                      {active.length} active projects{' '}
                      {w.demo && (
                        <span className="sample-label">Sample workspace</span>
                      )}
                    </span>
                    <label htmlFor="archived-projects">
                      <Switch
                        id="archived-projects"
                        checked={showArchived}
                        onCheckedChange={setShowArchived}
                        aria-label="Show archived projects"
                      />{' '}
                      Show archived
                    </label>
                  </div>
                  <div className="project-grid">
                    {projects
                      .filter((p) => showArchived || !p.archived)
                      .map((p) => {
                        const h = totalsFor(p.id),
                          pct = Math.round((h / p.budget) * 100);
                        return (
                          <section className="panel project-card" key={p.id}>
                            <div className="project-card-top">
                              <span className={`project-icon color-${p.color}`}>
                                {p.client[0]}
                              </span>
                              <span
                                className={
                                  p.archived ? 'status archived' : 'status'
                                }
                              >
                                {p.archived
                                  ? 'Archived'
                                  : pct >= 100
                                    ? 'Over budget'
                                    : 'Active'}
                              </span>
                              <button
                                className="icon-button"
                                aria-label={`Edit ${p.name}`}
                                onClick={() => {
                                  setError('');
                                  setModal({ type: 'project', project: p });
                                }}
                              >
                                <Pencil size={16} />
                              </button>
                            </div>
                            <small className="client-name">{p.client}</small>
                            <h2>{p.name}</h2>
                            <div className="project-budget-label">
                              <strong>
                                {h.toFixed(1)}
                                <span> / {p.budget} hours</span>
                              </strong>
                              <span
                                className={pct >= 90 ? 'budget-warning' : ''}
                              >
                                {pct}%
                              </span>
                            </div>
                            <Progress
                              className={`project-progress color-${p.color}`}
                              value={Math.min(100, pct)}
                              aria-label={`${p.name} time budget`}
                            />
                            <p
                              className={pct >= 90 ? 'budget-warning' : 'muted'}
                            >
                              {h > p.budget
                                ? `${(h - p.budget).toFixed(1)} hours over budget`
                                : `${(p.budget - h).toFixed(1)} hours remaining`}
                            </p>
                            <div className="project-card-bottom">
                              <span>
                                {money(p.rate, w.currency)}
                                <small>per hour · {w.currency}</small>
                              </span>
                              <button
                                className="icon-button"
                                disabled={busy}
                                aria-label={
                                  p.archived
                                    ? `Restore ${p.name}`
                                    : `Archive ${p.name}`
                                }
                                title={
                                  p.archived
                                    ? 'Restore project'
                                    : 'Archive project'
                                }
                                onClick={() =>
                                  void mutate('archiveProject', { id: p.id })
                                }
                              >
                                {p.archived ? (
                                  <RotateCcw size={16} />
                                ) : (
                                  <Archive size={16} />
                                )}
                              </button>
                              <button
                                className="button"
                                onClick={() => {
                                  go('Time tracker');
                                  setProjectFilter(p.id);
                                }}
                              >
                                View time <ArrowRight size={14} />
                              </button>
                            </div>
                          </section>
                        );
                      })}
                    <button
                      className="new-project-card"
                      onClick={() => {
                        setError('');
                        setModal({ type: 'project' });
                      }}
                    >
                      <span>
                        <Plus size={23} />
                      </span>
                      <strong>Make room for what’s next.</strong>
                      <small>Create a new project</small>
                    </button>
                  </div>
                </>
              )}
              {view === 'Reports' && (
                <>
                  <section className="report-banner">
                    <div>
                      <span className="eyebrow">
                        READY FOR YOUR NEXT INVOICE
                      </span>
                      <h2>Good work deserves a clear record.</h2>
                      <p>
                        Export the selected week’s entries, with client details,
                        rates, and billable amounts.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      disabled={!visibleEntries.length}
                      onClick={download}
                    >
                      <Download size={16} /> Export CSV
                    </button>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Create an invoice</h2>
                    </div>
                    <p className="invoice-intro">
                      Bill a client for a period. Billable time is charged at
                      each project’s rate; non-billable time is listed but not
                      charged. Preview, then Print → Save as PDF.
                    </p>
                    <InvoiceSetup clients={clients} onCreate={setInvoice} />
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Where your time went</h2>
                      <span>{weekLabel}</span>
                    </div>
                    <Table className="report-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead className="col-bh">
                            Billable hours
                          </TableHead>
                          <TableHead className="col-share">
                            Share of week
                          </TableHead>
                          <TableHead className="right">
                            Billable value ({w.currency})
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects
                          .filter((p) =>
                            periodEntries.some((e) => e.projectId === p.id),
                          )
                          .map((p) => {
                            const h = totalsFor(p.id, true),
                              bh = periodEntries
                                .filter(
                                  (e) => e.projectId === p.id && e.billable,
                                )
                                .reduce((a, e) => a + e.seconds / 3600, 0);
                            return (
                              <TableRow key={p.id}>
                                <TableCell>
                                  <div className="entry-work">
                                    <span
                                      className={`project-icon color-${p.color}`}
                                    >
                                      {p.client[0]}
                                    </span>
                                    <div>
                                      <strong>{p.name}</strong>
                                      <small>{p.client}</small>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>{h.toFixed(1)}h</TableCell>
                                <TableCell className="col-bh">
                                  {bh.toFixed(1)}h
                                </TableCell>
                                <TableCell className="col-share">
                                  <div className="report-share">
                                    <Progress
                                      value={
                                        total ? ((h * 3600) / total) * 100 : 0
                                      }
                                      aria-label={`${p.name} share of week`}
                                    />
                                    <span>
                                      {total
                                        ? Math.round(((h * 3600) / total) * 100)
                                        : 0}
                                      %
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="right">
                                  <strong>
                                    {money(bh * p.rate, w.currency)}
                                  </strong>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                    {!periodEntries.length && (
                      <Blank
                        title="The story is still unwritten."
                        text="Log time during this week to see your project breakdown."
                      />
                    )}
                    <div className="table-footer">
                      <span>
                        Running timers are included after you stop and save
                        them.
                      </span>
                      <strong>{money(value, w.currency)} total</strong>
                    </div>
                  </section>
                </>
              )}
              <footer className="workspace-footer">
                <span>A little more clarity. A little less admin.</span>
                <span>
                  {w.demo ? (
                    <button
                      onClick={() =>
                        setConfirm({
                          action: 'clearDemo',
                          payload: {},
                          title: 'Start with a clean slate?',
                          text: 'Remove the sample entries and unused sample projects. Any time you have logged and projects you have added will be kept.',
                        })
                      }
                    >
                      Clear sample data <ArrowRight size={13} />
                    </button>
                  ) : (
                    'Your personal consulting workspace'
                  )}
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError('');
          }
        }}
      >
        <DialogContent className="tempo-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal?.type === 'entry'
                ? modal.entry
                  ? 'Edit time entry'
                  : 'Make a note of your time'
                : modal?.type === 'project'
                  ? modal.project
                    ? 'A little project fine-tuning'
                    : 'Something good starts here.'
                  : 'Make yourself at home.'}
            </DialogTitle>
            <DialogDescription>
              {modal?.type === 'entry'
                ? 'The details today make invoicing easier tomorrow.'
                : modal?.type === 'project'
                  ? 'Set up your client, rate, and a little room to do your best work.'
                  : 'Set your name, currency, and weekly rhythm.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          {modal?.type === 'entry' && (
            <EntryForm
              entry={modal.entry}
              projects={projects}
              busy={busy}
              onCancel={() => setModal(null)}
              onDelete={
                modal.entry
                  ? () => {
                      const target = modal.entry;
                      if (!target) return;
                      setModal(null);
                      setConfirm({
                        action: 'deleteEntry',
                        payload: { id: target.id },
                        title: 'Delete this entry?',
                        text: `“${target.description}” will be permanently removed from your timesheet.`,
                      });
                    }
                  : undefined
              }
              onSave={async (p) => {
                const ok = await mutate('saveEntry', p);
                if (ok) setModal(null);
                return ok;
              }}
            />
          )}
          {modal?.type === 'project' && (
            <ProjectForm
              project={modal.project}
              busy={busy}
              onCancel={() => setModal(null)}
              onSave={async (p) => {
                const ok = await mutate('saveProject', p);
                if (ok) setModal(null);
                return ok;
              }}
            />
          )}
          {modal?.type === 'settings' && w && (
            <SettingsForm
              workspace={w}
              busy={busy}
              onSave={async (p) => {
                const ok = await mutate('saveSettings', p);
                if (ok) setModal(null);
                return ok;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setConfirm(null);
            setError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (confirm && (await mutate(confirm.action, confirm.payload)))
                  setConfirm(null);
              }}
            >
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {invoice && w && (
        <Invoice
          workspace={w}
          projects={projects}
          entries={entries}
          request={invoice}
          onClose={() => setInvoice(null)}
        />
      )}
      {user?.role === 'owner' && (
        <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      )}
    </SidebarProvider>
  );
}
function SettingsForm({
  workspace: w,
  busy,
  onSave,
}: {
  workspace: Workspace;
  busy: boolean;
  onSave: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [currency, setCurrency] = useState(w.currency);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSave({
          name: f.get('name'),
          goal: Number(f.get('goal')),
          currency,
        });
      }}
    >
      <label>
        Your name
        <input name="name" maxLength={80} required defaultValue={w.name} />
      </label>
      <label>
        Weekly hours goal
        <input
          name="goal"
          type="number"
          min="1"
          max="168"
          step="0.5"
          required
          defaultValue={w.goal}
        />
      </label>
      <div className="form-field">
        <span>Workspace currency</span>
        <Picker
          label="Workspace currency"
          value={currency}
          onChange={setCurrency}
          items={['USD', 'CAD', 'EUR', 'GBP', 'AUD'].map((v) => ({
            value: v,
            label: v,
          }))}
        />
      </div>
      <p className="form-note">
        Currency applies to all projects. Changing it relabels your rates; it
        does not convert amounts.
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  );
}
