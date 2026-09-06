# Tempo operations runbook — member management & owner recovery

Practical, copy-pasteable procedures for running Tempo's invite-only, per-user
workspaces: inviting and removing members, helping people who lost a device,
and — the important one — recovering the **owner** account when its passkey is
gone.

This is the source of truth for operations. The design rationale lives in
[`docs/superpowers/specs/2026-09-05-multi-user-passkey-auth-design.md`](./superpowers/specs/2026-09-05-multi-user-passkey-auth-design.md);
the implementation lives in `lib/auth-server.ts`, `lib/auth.ts`,
`lib/passkeys.ts`, `lib/admin.ts`, `app/api/auth/*`, and `app/api/admin/*`.

- **Live site:** https://tempo.cillierd.workers.dev
- **Cloudflare account:** `cillierd@mcmaster.ca` · **D1 database:** `tempo`
- **Owner:** `davdancilai@gmail.com`

---

## 1. Mental model (read this once)

**Roles.** There is exactly **one owner** — enforced at the database level by a
partial unique index (`one_owner` on `users.role = 'owner'`). Everyone else is a
**member**. Only the owner can manage members.

**Workspaces are isolated per user.** Each user (owner and members) has one row
in the `workspaces` table, keyed by their **user id** (a UUID). Every
`/api/workspace` request resolves that id *only* from the verified session —
there is no request path where one user can name another user's workspace.
Member data is private even from the owner.

> The original single-user data lived in the workspace row with id `'solo'`.
> When the owner first registered, that row's data was **copied** into a new row
> keyed by the owner's UUID. The `'solo'` row still exists as a frozen snapshot —
> this matters for owner recovery (§6).

**Passkeys (WebAuthn).** Sign-in is a passkey (Face ID / Touch ID / fingerprint /
security key), verified server-side with `@simplewebauthn`. Passkeys are bound to
the **hostname** (`tempo.cillierd.workers.dev` in production, `localhost` in dev).
Changing domains invalidates every passkey — see §8.

> **One passkey per enrollment.** A successful passkey registration **deletes**
> the setup code that authorized it. There is no in-app "add another device"
> button for an already-registered user. To get a fresh passkey a user needs a
> new setup code, and issuing one **wipes their previous passkey**. The practical
> answer is to enroll a **synced** passkey (iCloud Keychain, Google Password
> Manager, 1Password, …) so the same credential works across devices and
> survives a lost phone. This is strongly recommended for the owner (§6).

**Setup codes.** A one-time code (12 characters, unambiguous alphabet — no
`0/1/I/O`) that authorizes a passkey registration. One active code per user,
**stored hashed**, **expires in 24 hours**, and allows **at most 5 attempts**
(every submission, even the correct one, spends an attempt). The plaintext code
is shown **once** at generation and never again.

**Sessions.** Server-side, revocable rows in `auth_sessions` (~30-day lifetime).
The session cookie is HMAC-signed, `HttpOnly; Secure; SameSite=Strict`. Logging
out deletes that one session (this device). Reissuing a member's code deletes
**all** of their sessions (every device).

**Rate limiting.** Register/login are throttled to 40 attempts per IP and 12 per
email per 15-minute window. Tripping it returns *"Too many attempts. Try again
in 15 minutes."*

---

## 2. Worker secrets & config

| Secret | Purpose | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | Master HMAC key: signs session/challenge cookies and derives setup-code hashes. | Must be ≥ 32 chars. Rotating it signs **everyone** out and invalidates **pending setup codes** — but does **not** delete passkeys (users just sign back in). See §7. |
| `OWNER_EMAIL` | The single email allowed to be the owner / bootstrap the owner. | Lowercased on compare. |
| `OWNER_SETUP_CODE` | One-time code the owner uses to register the first passkey. | Only usable **while no owner exists**; inert afterward. Central to owner recovery (§6). |
| `AUTH_ORIGIN` *(optional)* | Overrides the expected site origin. | Defaults to `https://tempo.cillierd.workers.dev`. `http://localhost` is auto-allowed in dev. |

- **Production** secrets are set with `wrangler secret put` (below). They are
  stored on Cloudflare's side and **persist across `wrangler deploy`** — a
  redeploy will not wipe them.
- **Local dev** reads the same names from `.dev.vars` (gitignored) for
  `npm run dev`.

Most commands below need the generated Worker config, which exists only after a
build:

```bash
npm run build                    # produces dist/server/wrangler.json
CFG=dist/server/wrangler.json    # used by the commands in this doc
```

> No local build handy? Everything in §4–§6 that touches the database can also be
> run from the **Cloudflare dashboard → D1 → `tempo` → Console**, and secrets
> from **Workers & Pages → your Worker → Settings → Variables**.

---

## 3. Everyday member management (no command line)

The owner does all routine member management from the app UI.

1. Sign in as the owner.
2. In the left sidebar footer, click **Manage members** (the gear button — it
   only appears for the owner).

### Invite a member

1. Type the person's email → **Invite**.
2. Tempo shows the setup code **once**. Click **Copy invite message** for a
   ready-to-send message (includes the site link and step-by-step), or **Copy
   code only**.
3. Send it to them however you like — **Tempo sends no email**. The code expires
   in 24 hours.

### What the member does

1. Open https://tempo.cillierd.workers.dev
2. Click **"First visit or lost your passkey? Use a setup code."**
3. Enter their email + the setup code → **Create my passkey** and approve the
   device prompt.
4. They land in a fresh, empty workspace with a Quick Start guide.

### Member status labels

| Label | Meaning |
| --- | --- |
| **Owner** | The owner account. |
| **Active · Passkey ready** | Registered and can sign in. |
| **Pending · Setup code issued** | Invited; code still valid, not yet used. |
| **Pending · Needs a new code** | Invited; code expired — reissue one. |

### Reissue a code (member lost a device, or code expired)

Click the **↻ (reissue)** button next to the member. This:

- signs them out on **every** device,
- **revokes their old passkey(s)** and any old code,
- issues a **new** one-time code (copy & send as above),
- **keeps their workspace** intact.

They then register a fresh passkey via the setup-code flow.

### Remove a member

Click the **🗑 (remove)** button. This **permanently deletes** the member, their
passkeys, and **their entire workspace**. It cannot be undone. (The owner cannot
be removed this way.)

---

## 4. Owner bootstrap (reference)

This has already been done for the live site; documented here for completeness
and for stand-up of a new environment.

1. Ensure `AUTH_SECRET`, `OWNER_EMAIL`, and `OWNER_SETUP_CODE` are set.
2. Open the site → **"First visit or lost your passkey? Use a setup code."**
3. Enter `OWNER_EMAIL` + `OWNER_SETUP_CODE` → create the passkey.

On success Tempo creates the single owner user, copies the `'solo'` workspace
data into the owner's workspace, signs the owner in, and the bootstrap code
becomes inert (an owner now exists).

> **Do this with a synced passkey.** See §6 for why.

---

## 5. Database access

You'll need §6 (owner recovery) and the read-only helpers in §9 to talk to D1.

```bash
# Read-only example (production). --remote = live DB. Omit it / use --local for dev.
npx wrangler d1 execute tempo --remote --config "$CFG" \
  --command "SELECT id,email,role FROM users ORDER BY created_at;"
```

- `--remote` hits the **production** database. `--local` hits the dev database
  used by `npm run dev`. **Always double-check which one you're pointed at.**
- Add `-y` to skip the confirmation prompt on writes / file execution.
- File form (used for migrations): `--file=drizzle/XXXX.sql`.

> ⚠️ **Writes are irreversible and there is no undo.** Before any `UPDATE` /
> `DELETE` / `INSERT` against `--remote`, take a backup (§9) and read the
> statement twice.

---

## 6. Owner recovery — lost passkey, no synced backup

This is the one scenario with no self-service path: the reissue button is
member-only, and the single-owner index means you can't just add a second owner.
Recovery is a short, deliberate database + secret procedure.

> **Prevention beats recovery.** Enroll the owner passkey in a **synced**
> credential manager (iCloud Keychain / Google Password Manager / 1Password). A
> synced passkey survives a lost or replaced device and works across your
> devices, so you never need this section. There is no way for the owner to add a
> second passkey after setup without going through recovery.

### 6a. Data-preserving recovery (recommended)

Because a re-bootstrap seeds the new owner workspace from the **`'solo'`** row —
which holds *stale* data from the original migration, **not** your current data —
you must first stage your current data into `'solo'`. Keep a build available so
`$CFG` is set (§2), or use the Cloudflare D1 console for the SQL steps.

**Step 0 — Back up.** Save a copy of the whole workspace + user tables:

```bash
npx wrangler d1 execute tempo --remote --config "$CFG" --json \
  --command "SELECT id,revision,data FROM workspaces;" > owner-recovery-backup.json
npx wrangler d1 execute tempo --remote --config "$CFG" \
  --command "SELECT id,email,role,created_at FROM users;"
```

**Step 1 — Find the current owner id:**

```bash
npx wrangler d1 execute tempo --remote --config "$CFG" \
  --command "SELECT id,email FROM users WHERE role='owner';"
```

Note the id as `OWNER_ID`.

**Step 2 — Stage the owner's current data into `'solo'`** so the re-bootstrap
restores *current* data (replace `OWNER_ID`):

```bash
# If a 'solo' row exists (it normally does):
npx wrangler d1 execute tempo --remote --config "$CFG" -y \
  --command "UPDATE workspaces SET data=(SELECT data FROM workspaces WHERE id='OWNER_ID'), revision=0 WHERE id='solo';"

# If there is NO 'solo' row, create one instead:
npx wrangler d1 execute tempo --remote --config "$CFG" -y \
  --command "INSERT INTO workspaces (id,data,revision) SELECT 'solo', data, 0 FROM workspaces WHERE id='OWNER_ID';"
```

**Step 3 — Delete the owner account** so the bootstrap path re-opens (this
cascades away the owner's passkeys, codes, sessions, and challenges; it leaves
the `OWNER_ID` workspace row orphaned, which is fine — you copied it to `'solo'`):

```bash
npx wrangler d1 execute tempo --remote --config "$CFG" -y \
  --command "DELETE FROM users WHERE role='owner';"
```

**Step 4 — Set a fresh one-time bootstrap code** (and confirm the owner email):

```bash
npx wrangler secret put OWNER_SETUP_CODE --config "$CFG"   # enter a fresh random string, ≥12 chars
npx wrangler secret list --config "$CFG"                   # confirm OWNER_EMAIL + AUTH_SECRET present
# Recovering onto a NEW owner email? Also run:
# npx wrangler secret put OWNER_EMAIL --config "$CFG"
```

Secret changes apply to the live Worker on the next request — no redeploy needed.

**Step 5 — Re-register on the site.** Open
https://tempo.cillierd.workers.dev → **"First visit or lost your passkey? Use a
setup code."** → enter `OWNER_EMAIL` + the new `OWNER_SETUP_CODE` → approve the
passkey. This recreates the owner (new id), copies `'solo'` (= your current data)
into the new owner workspace, and signs you in. **Enroll a synced passkey this
time.**

**Step 6 — Clean up:**

```bash
# Invalidate the bootstrap code (it's already inert now an owner exists — this is hygiene):
npx wrangler secret delete OWNER_SETUP_CODE --config "$CFG"

# Optional: once you've confirmed the new owner workspace looks right, drop the orphaned old row:
npx wrangler d1 execute tempo --remote --config "$CFG" -y \
  --command "DELETE FROM workspaces WHERE id='OWNER_ID';"
```

### 6b. Simple recovery (accept resetting to the migration snapshot)

If you don't need data changed since the original migration (or `'solo'` already
holds what you want), skip Step 2: back up, delete the owner (Step 3), set
`OWNER_SETUP_CODE` (Step 4), and re-register (Step 5). The new owner starts from
whatever `'solo'` contains. **Only use this if you accept losing owner-workspace
changes made after the initial migration.**

---

## 7. Rotating `AUTH_SECRET`

Rotate only if you believe the secret leaked. Effects:

- **Everyone is signed out** (existing session cookies stop verifying) — they
  simply sign back in with their **existing passkeys**, which keep working.
- **Pending setup codes stop working** (their stored hashes no longer match) —
  reissue codes for anyone mid-onboarding, and set a fresh `OWNER_SETUP_CODE` if
  an owner bootstrap is in flight.
- Passkeys and workspace data are **unaffected**.

```bash
npx wrangler secret put AUTH_SECRET --config "$CFG"   # enter a new ≥32-char random value
```

---

## 8. Changing the domain

Everything is bound to `tempo.cillierd.workers.dev`. If you move to a custom
domain:

- Set `AUTH_ORIGIN` to the new origin (the passkey relying-party id follows the
  request host automatically).
- **Every** passkey — the owner's included — becomes invalid, because passkeys
  are bound to the old host. Everyone must register a **new** passkey on the new
  host.

Plan a cutover window: reissue setup codes for all members, and re-bootstrap the
owner via §6 on the new host (a synced passkey does **not** carry across a
hostname change).

---

## 9. Read-only helpers & backups

Safe, read-only queries for diagnosing issues. (Swap `--remote` for `--local` to
inspect the dev DB.)

```bash
# Everyone, with passkey count and any pending code expiry (mirrors the admin panel):
npx wrangler d1 execute tempo --remote --config "$CFG" --command "
  SELECT u.email, u.role,
         (SELECT count(*) FROM credentials c WHERE c.user_id=u.id) AS passkeys,
         (SELECT expires_at FROM setup_codes s WHERE s.user_id=u.id) AS code_expires_at
  FROM users u ORDER BY u.created_at;"

# Orphaned workspaces (rows with no matching user and not the legacy 'solo' snapshot):
npx wrangler d1 execute tempo --remote --config "$CFG" --command "
  SELECT w.id FROM workspaces w
  WHERE w.id <> 'solo' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.id);"

# Full backup of the data that matters before any write:
npx wrangler d1 execute tempo --remote --config "$CFG" --json \
  --command "SELECT id,revision,data FROM workspaces;" > tempo-workspaces-backup.json
```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Member: *"invalid, expired, or locked"* code | Code expired (24h), already used, or 5 attempts spent. **Reissue** it (§3). |
| Member: *"No passkey is available…"* on sign-in | They never finished registration, or their passkey was revoked by a reissue. Send a fresh code and have them register. |
| *"Too many attempts. Try again in 15 minutes."* | Rate limit (40/IP, 12/email per 15 min). Wait it out. |
| *"Sign in using Tempo's configured address."* | Reaching the site on the wrong origin. Use `https://tempo.cillierd.workers.dev` (or the configured `AUTH_ORIGIN`). |
| Owner locked out, passkey lost | §6. If a synced passkey exists on another device, just sign in there first. |
| New device / browser for an existing user | If the passkey is synced (iCloud/Google/1Password) it's already there. If not, it's effectively a lost passkey — reissue a code (member) or run §6 (owner). |
| *"Passkeys are not supported here."* | Old/unsupported browser. Use a recent Chrome, Safari, Edge, or Firefox. |

---

## 11. Table reference

Schema is defined in [`db/schema.ts`](../db/schema.ts) (migrations in
`drizzle/`). Quick map:

- **`users`** — `id`, `email` (unique), `role` (`owner`/`member`, one owner max),
  `token_version`, `created_at`.
- **`credentials`** — registered passkeys; `user_id` → `users` (cascade delete).
- **`setup_codes`** — one hashed, expiring, attempt-limited code per user
  (cascade delete).
- **`auth_sessions`** — server-side revocable sessions (cascade delete).
- **`auth_challenges`** — short-lived, single-use WebAuthn challenges (cascade
  delete).
- **`auth_limits`** — rate-limit counters.
- **`workspaces`** — one row per user id holding the app-data JSON blob +
  `revision`; plus the legacy `'solo'` snapshot. **No** foreign key to `users`,
  which is why deleting a user leaves an orphaned workspace row (see §6).
</content>
</invoke>
