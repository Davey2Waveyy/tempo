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
export function seedWorkspace(): Workspace {
  const dates = weekDates();
  const projects: Project[] = [
    {
      id: 'acme',
      name: 'Brand strategy',
      client: 'Acme Studio',
      rate: 150,
      budget: 40,
      color: 0,
      archived: false,
    },
    {
      id: 'northstar',
      name: 'Digital transformation',
      client: 'Northstar',
      rate: 175,
      budget: 60,
      color: 1,
      archived: false,
    },
    {
      id: 'forma',
      name: 'Product advisory',
      client: 'Forma',
      rate: 125,
      budget: 30,
      color: 2,
      archived: false,
    },
    {
      id: 'practice',
      name: 'Building the practice',
      client: 'Internal',
      rate: 0,
      budget: 20,
      color: 3,
      archived: false,
    },
  ];
  const tasks: [string, string, number, number, boolean][] = [
    ['Discovery workshop & stakeholder interviews', 'acme', 4, 2.5, true],
    ['Product roadmap review', 'forma', 4, 2, true],
    ['Proposal & weekly planning', 'practice', 4, 1.5, false],
    ['Operating model design', 'northstar', 3, 5, true],
    ['Positioning & competitive landscape', 'acme', 3, 3, true],
    ['Product research synthesis', 'forma', 2, 3, true],
    ['Admin & business development', 'practice', 2, 2, false],
    ['Transformation roadmap', 'northstar', 1, 5, true],
    ['Brand platform exploration', 'acme', 1, 2.5, true],
    ['Leadership alignment workshop', 'northstar', 0, 4.5, true],
    ['Learning & development', 'practice', 0, 1.5, false],
  ];
  return {
    projects,
    entries: tasks.map(([description, projectId, day, h, billable], i) => ({
      id: `demo-${i}`,
      description,
      projectId,
      date: dates[day],
      seconds: h * 3600,
      billable,
    })),
    timer: null,
    name: 'Solo consultant',
    currency: 'USD',
    goal: 40,
    demo: true,
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
