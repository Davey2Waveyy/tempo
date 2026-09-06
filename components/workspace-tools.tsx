'use client';
import { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  FolderKanban,
  LayoutDashboard,
  Clock3,
  ChartNoAxesCombined,
  Settings2,
  Play,
  Square,
  ArrowRight,
  TriangleAlert,
  Command as CommandIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import {
  clockTime,
  duration,
  dateKey,
  money,
  type Entry,
  type Project,
  type Timer,
} from '@/lib/tempo';
import { recentTasks, budgetAlerts, dayTotals } from '@/lib/workspace-insights';
export function QuickActions({
  projects,
  onNavigate,
  onLog,
  onProject,
  onSettings,
  onProjectTime,
}: {
  projects: Project[];
  onNavigate: (view: string) => void;
  onLog: () => void;
  onProject: () => void;
  onSettings: () => void;
  onProjectTime: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (value) setQuery('');
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuery('');
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const run = (action: () => void) => {
    setOpen(false);
    setTimeout(action, 0);
  };
  return (
    <>
      <button
        className="quick-action-trigger"
        onClick={() => changeOpen(true)}
        aria-label="Search actions and projects"
      >
        <Search size={15} />
        <span>Jump to anything…</span>
        <kbd>
          <CommandIcon size={11} /> K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="quick-action-dialog" showCloseButton={false}>
          <DialogTitle className="sr-only">Quick actions</DialogTitle>
          <DialogDescription className="sr-only">
            Search actions and projects. Use arrow keys to move and Enter to
            select.
          </DialogDescription>
          <Command>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="What would you like to do?"
              aria-label="Search actions and projects"
            />
            <CommandList>
              <CommandEmpty>
                No matches. Try a client, project, or action.
              </CommandEmpty>
              <CommandGroup heading="Create">
                <CommandItem onSelect={() => run(onLog)}>
                  <Plus /> Log time <CommandShortcut>NEW ENTRY</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => run(onProject)}>
                  <FolderKanban /> Create a project
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Go to">
                {[
                  { label: 'Overview', Icon: LayoutDashboard },
                  { label: 'Time tracker', Icon: Clock3 },
                  { label: 'Projects', Icon: FolderKanban },
                  { label: 'Reports', Icon: ChartNoAxesCombined },
                ].map(({ label, Icon }) => (
                  <CommandItem
                    key={label}
                    onSelect={() => run(() => onNavigate(label))}
                  >
                    <Icon />
                    {label}
                  </CommandItem>
                ))}
                <CommandItem onSelect={() => run(onSettings)}>
                  <Settings2 /> Workspace settings
                </CommandItem>
              </CommandGroup>
              {projects.length > 0 && (
                <CommandGroup heading="Project timesheets">
                  {projects.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.id} ${p.name} ${p.client}`}
                      onSelect={() => run(() => onProjectTime(p.id))}
                    >
                      <span className={`project-icon color-${p.color}`}>
                        {p.client[0]}
                      </span>
                      <span>
                        {p.name}
                        <small>
                          {p.client}
                          {p.archived ? ' · Archived' : ''}
                        </small>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="command-hint">
            <span>↑ ↓ to navigate · Enter to open</span>
            <kbd>esc</kbd>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function RecentWork({
  entries,
  projects,
  busy,
  onStart,
}: {
  entries: Entry[];
  projects: Project[];
  busy: boolean;
  onStart: (entry: Entry) => void;
}) {
  const tasks = recentTasks(entries, projects);
  if (!tasks.length) return null;
  return (
    <section className="recent-work" aria-label="Restart recent work">
      <div className="recent-work-heading">
        <span>Pick up where you left off</span>
        <small>Starts a new timer</small>
      </div>
      <div className="recent-work-list">
        {tasks.map((entry) => {
          const p = projects.find((p) => p.id === entry.projectId)!;
          return (
            <button
              key={entry.id}
              className="recent-work-item"
              disabled={busy}
              onClick={() => onStart(entry)}
            >
              <span className={`project-icon color-${p.color}`}>
                <Play size={13} fill="currentColor" />
              </span>
              <span>
                <strong>{entry.description}</strong>
                <small>
                  {p.client} · {p.name}
                </small>
              </span>
              <ArrowRight className="resume-arrow" size={15} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
export function DayNavigator({
  dates,
  entries,
  selected,
  onSelect,
}: {
  dates: string[];
  entries: Entry[];
  selected: string | null;
  onSelect: (date: string | null) => void;
}) {
  const totals = dayTotals(entries);
  const today = dateKey(new Date());
  return (
    <div className="day-navigator" aria-label="Timesheet day filter">
      <button
        className={!selected ? 'selected' : ''}
        aria-pressed={!selected}
        onClick={() => onSelect(null)}
      >
        <span>Full week</span>
        <strong>
          {duration(entries.reduce((sum, e) => sum + e.seconds, 0))}
        </strong>
      </button>
      {dates.map((date, i) => (
        <button
          key={date}
          className={`${selected === date ? 'selected' : ''} ${date === today ? 'is-today' : ''}`}
          aria-pressed={selected === date}
          aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}, ${date}, ${duration(totals.get(date) || 0)}`}
          onClick={() => onSelect(selected === date ? null : date)}
        >
          <span>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}{' '}
            <em>{Number(date.slice(-2))}</em>
            {date === today && <i />}
          </span>
          <strong>
            {totals.has(date) ? duration(totals.get(date)!) : '—'}
          </strong>
        </button>
      ))}
    </div>
  );
}
export function BudgetAttention({
  projects,
  entries,
  onOpen,
}: {
  projects: Project[];
  entries: Entry[];
  onOpen: (id: string) => void;
}) {
  const alerts = budgetAlerts(projects, entries);
  if (!alerts.length) return null;
  return (
    <section className="budget-attention" aria-label="Project budget alerts">
      <div className="attention-heading">
        <span>
          <TriangleAlert size={16} /> A little attention now goes a long way.
        </span>
        <small>
          {alerts.length}{' '}
          {alerts.length === 1 ? 'project needs' : 'projects need'} a budget
          check
        </small>
      </div>
      <div className="attention-items">
        {alerts.slice(0, 3).map(({ project, remaining, ratio }) => (
          <button key={project.id} onClick={() => onOpen(project.id)}>
            <span
              className={`attention-indicator ${ratio >= 1 ? 'over' : ''}`}
            />
            <span>
              <strong>{project.name}</strong>
              <small>
                {project.client} ·{' '}
                {remaining < 0
                  ? `${Math.abs(remaining).toFixed(1)}h over budget`
                  : remaining === 0
                    ? 'Time budget reached'
                    : `${remaining.toFixed(1)}h left in the budget`}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}
export function TimerDock({
  timer,
  project,
  currency,
  busy,
  onStop,
  onOpen,
  hasMainTimer,
}: {
  timer: Timer;
  project?: Project;
  currency: string;
  busy: boolean;
  onStop: () => void;
  onOpen: () => void;
  hasMainTimer: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(!hasMainTimer);
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      document.title = `${clockTime((time - timer.startedAt) / 1000)} · ${timer.description} — Tempo`;
    };
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = 'Tempo — Make time count';
    };
  }, [timer.startedAt, timer.description]);
  useEffect(() => {
    const target = document.querySelector('[data-main-timer]');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMainTimer]);
  const seconds = Math.max(0, (now - timer.startedAt) / 1000);
  return (
    <div
      className={`timer-dock ${visible ? 'visible' : ''}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <button
        className="dock-task"
        onClick={onOpen}
        aria-label="Open running task in time tracker"
      >
        <span className="live-dot" />
        <span>
          <strong>{timer.description}</strong>
          <small>
            {project?.client} · {project?.name}
          </small>
        </span>
      </button>
      <div className="dock-time">
        <strong>{clockTime(seconds)}</strong>
        <small>
          {timer.billable
            ? `${money((seconds / 3600) * (project?.rate || 0), currency)} billable`
            : 'Non-billable'}
        </small>
      </div>
      <button
        className="dock-stop"
        disabled={busy}
        onClick={onStop}
        aria-label="Stop running timer and save"
      >
        <Square size={13} fill="currentColor" />
        <span>Stop & save</span>
      </button>
    </div>
  );
}
