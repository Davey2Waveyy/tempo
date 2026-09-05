# Tempo

A consultant's private workspace for time tracking, project budgets, and weekly reporting.

## What works

- Start and stop a durable timer; returning to the app resumes its elapsed-time display.
- Create, edit, and delete dated entries with billable status.
- Manage clients through projects, hourly rates, time budgets, and archiving.
- Review weekly activity, goal progress, billable utilization, and project totals.
- Export selected timesheets to CSV with formula-injection protection.
- Set a name, weekly target, and workspace currency.
- Clear sample entries without deleting newly recorded work.

Data is stored in Cloudflare D1. Optimistic revision checks prevent silent overwrites from another tab. The hosted site is owner-private through Sites access control. This is one personal workspace, not a multi-tenant SaaS; keep owner-only access until per-user authorization and separate workspaces are implemented. Changing a project rate recalculates historical values. Currency changes relabel amounts rather than converting them. Running timers are excluded from reports until saved.

## Development

Use Node 22.13+ and `npm install`. Start with `npm run dev`. Generate schema migrations with `npm run db:generate` and apply the generated SQL to the local D1 database with Wrangler. Hosted migrations are included in the Sites package and applied during publication.

`npm run build` creates the production Worker and static assets. `npx tsc --noEmit` checks types. `npx oxlint app lib db` checks authored application code. The scaffold's full lint command reports existing issues in unused vendored UI components and its mobile hook; those files were not modified.

## Validation

`node tests/workspace.test.mjs` exercises a local development instance (default port 3001; override TEMPO_TEST_URL). It creates test records and writes `/tmp/tempo-restore.sql` before mutations. Apply that SQL to the same local database afterward to restore its original contents. Run only against a disposable local workspace containing the initial sample data.

The workflow check covers persisted CRUD, timer start/stop and duplicate prevention, archiving, rate calculations, invalid inputs, conflicting revisions, cross-origin writes, CSV escaping, and clearing samples while preserving new data. The production build, type check, and authored-code lint passed. Browser visual/interaction testing was not requested. Optional WebMCP read and log-entry tools are feature-detected; a supported browser validation context was not available, so those integrations have not been verified.
