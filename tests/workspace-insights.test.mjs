import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recentTasks,
  projectHours,
  budgetAlerts,
  dayTotals,
} from '../lib/workspace-insights.ts';
const projects = [
  { id: 'a', name: 'Advisory', client: 'Atlas', budget: 10, archived: false },
  { id: 'b', name: 'Research', client: 'Boreal', budget: 5, archived: false },
  { id: 'c', name: 'Old work', client: 'Closed', budget: 1, archived: true },
];
const entry = (
  id,
  projectId,
  date,
  seconds,
  description = 'Workshop',
  billable = true,
) => ({ id, projectId, date, seconds, description, billable });
test('recent tasks exclude archived/missing projects and deduplicate by task AND billing status', () => {
  const data = [
    entry('old', 'a', '2026-09-01', 3600),
    entry('new', 'a', '2026-09-04', 3600, ' workshop '),
    entry('nonbill', 'a', '2026-09-04', 500, 'Workshop', false),
    entry('archived', 'c', '2026-09-05', 100),
    entry('missing', 'x', '2026-09-06', 100),
    entry('research', 'b', '2026-09-03', 200),
  ];
  const before = JSON.stringify(data);
  assert.deepEqual(
    recentTasks(data, projects).map((e) => e.id),
    ['new', 'nonbill', 'research'],
  );
  assert.equal(JSON.stringify(data), before);
  assert.equal(recentTasks(data, projects, 1).length, 1);
});
test('budget alerts include non-billable work and distinguish threshold, full budget, and overrun', () => {
  const data = [
    entry('1', 'a', '2026-09-01', 7 * 3600),
    entry('2', 'a', '2026-09-02', 3600, 'Admin', false),
    entry('3', 'b', '2026-09-02', 6 * 3600),
    entry('4', 'c', '2026-09-02', 9 * 3600),
  ];
  const alerts = budgetAlerts(projects, data);
  assert.deepEqual(
    alerts.map((a) => a.project.id),
    ['b', 'a'],
  );
  assert.equal(alerts[0].remaining, -1);
  assert.equal(alerts[1].ratio, 0.8);
  assert.equal(projectHours(data).get('a'), 8);
  assert.deepEqual(budgetAlerts([{ ...projects[0], budget: 0 }], data), []);
});
test('day totals retain seconds and empty inputs are safe', () => {
  const totals = dayTotals([
    entry('a', 'a', '2026-09-01', 59),
    entry('b', 'b', '2026-09-01', 61),
    entry('c', 'a', '2026-09-02', 900),
  ]);
  assert.equal(totals.get('2026-09-01'), 120);
  assert.equal(totals.get('2026-09-02'), 900);
  assert.deepEqual(recentTasks([], projects), []);
  assert.equal(projectHours([]).size, 0);
  assert.deepEqual(budgetAlerts(projects, []), []);
});
