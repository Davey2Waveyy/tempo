import type { Entry, Project } from './tempo';
export function projectHours(entries: Entry[]) {
  const totals = new Map<string, number>();
  for (const entry of entries)
    totals.set(
      entry.projectId,
      (totals.get(entry.projectId) || 0) + entry.seconds / 3600,
    );
  return totals;
}
export function recentTasks(entries: Entry[], projects: Project[], limit = 3) {
  const active = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const seen = new Set<string>();
  return [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((entry) => {
      const key = JSON.stringify([
        entry.projectId,
        entry.description.trim().toLowerCase(),
        entry.billable,
      ]);
      if (!active.has(entry.projectId) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
export function budgetAlerts(projects: Project[], entries: Entry[]) {
  const totals = projectHours(entries);
  return projects
    .filter((p) => !p.archived && p.budget > 0)
    .map((project) => {
      const used = totals.get(project.id) || 0;
      return {
        project,
        used,
        ratio: used / project.budget,
        remaining: project.budget - used,
      };
    })
    .filter((item) => item.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio);
}
export function dayTotals(entries: Entry[]) {
  const totals = new Map<string, number>();
  for (const entry of entries)
    totals.set(entry.date, (totals.get(entry.date) || 0) + entry.seconds);
  return totals;
}
