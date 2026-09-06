export type Project = {
  id: string;
  name: string;
  client: string;
  rate: number;
  budget: number;
  color: number;
  archived: boolean;
};
export type Entry = {
  id: string;
  description: string;
  projectId: string;
  date: string;
  seconds: number;
  billable: boolean;
};
export type Timer = {
  description: string;
  projectId: string;
  billable: boolean;
  startedAt: number;
  date: string;
};
export type Workspace = {
  projects: Project[];
  entries: Entry[];
  timer: Timer | null;
  name: string;
  currency: string;
  goal: number;
  demo: boolean;
};
export type Snapshot = { workspace: Workspace; revision: number };
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekDates(offset = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const v = new Date(d);
    v.setDate(d.getDate() + i);
    return dateKey(v);
  });
}
export function hours(seconds: number) {
  return seconds / 3600;
}
export function duration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
export function clockTime(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
export function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
// A brand-new workspace starts empty and clean — new members are not
// seeded with sample projects or entries. The app's empty states guide
// them to create their first project and log their first entry.
export function seedWorkspace(): Workspace {
  return {
    projects: [],
    entries: [],
    timer: null,
    name: 'My workspace',
    currency: 'USD',
    goal: 40,
    demo: false,
  };
}
export function csvExport(
  entries: Entry[],
  projects: Project[],
  currency: string,
) {
  const cell = (v: unknown) => {
    let s = String(v);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [
      'Date',
      'Client',
      'Project',
      'Description',
      'Hours',
      'Billable',
      'Hourly rate',
      'Amount',
      'Currency',
    ],
    ...entries.map((e) => {
      const p = projects.find((p) => p.id === e.projectId);
      return [
        e.date,
        p?.client || '',
        p?.name || '',
        e.description,
        (e.seconds / 3600).toFixed(4),
        e.billable ? 'Yes' : 'No',
        p?.rate || 0,
        e.billable ? ((e.seconds / 3600) * (p?.rate || 0)).toFixed(2) : '0.00',
        currency,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
