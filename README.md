# Tempo

Invite-only time tracking for independent consultants. Each passkey account has a private workspace; the owner manages invitations, not members' timesheets.

## Everyday workflow

- Start a timer, or restart a recent task with its project and billable setting intact.
- The floating timer appears when the main timer scrolls away, or while viewing projects and reports. Stop and save from anywhere.
- Log and edit completed work; filter timesheets by week, day, project, billing status, or search. CSV exports respect the current filters.
- Find actions and project timesheets from the search button or Command/Ctrl + K.
- Track project budgets. The overview flags active projects at 80% of their budget and distinguishes time remaining from overruns. Budgets include non-billable work.
- Search projects by client or project name. Archive completed projects without losing entries.
- Review weekly billable value and utilization; create printable per-client invoices.
- Install the app on a home screen using the existing PWA support.

Running timers enter totals after being saved. Rates apply to all a project's entries, including historical work. Currency settings relabel amounts without converting them. New members start with an empty workspace.

## Development and deployment

Node 22.13+ and npm are required. Run `npm install`, then `npm run dev`. Authentication requires the ignored `.dev.vars` settings described in `docs/superpowers/specs/2026-09-05-multi-user-passkey-auth-design.md`. Do not commit real secrets.

`npm run build` creates a Cloudflare Worker and static assets. The existing production app is `https://tempo.cillierd.workers.dev`, with its D1 binding configured in `vite.config.ts`. Preserve this origin: passkeys are domain-bound. Schema migrations are generated with `npm run db:generate`; apply new migrations to the intended local or remote database before deploying schema changes.

## Checks

- `npx tsc --noEmit`
- `npx oxlint app lib db components/workspace-tools.tsx`
- `node --test tests/auth.test.mjs tests/workspace-insights.test.mjs`
- `node tests/workspace-ui.e2e.mjs`

The UI test requires a running localhost preview on port 3001, local D1 schema, `.dev.vars`, and Google Chrome on macOS. It creates a randomly identified local fixture account, checks timers, project search, day filtering, keyboard navigation, and mobile layouts, then removes only that account. Screenshots are saved in `/tmp`. It never connects to the production app or database.

`tests/passkeys.e2e.mjs` is the separate authentication-ceremony test and requires a disposable local database and virtual authenticator; it is not suitable for a populated workspace. Full scaffold lint also reports existing issues in vendored UI components. WebMCP remains optional and feature-detected.
