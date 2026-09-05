# Tempo — Multi-user passkey auth & per-user workspaces

- **Date:** 2026-09-05
- **Status:** Approved design, pending spec review
- **Scope:** Auth + multi-tenant foundation. Stripe billing is a separate future cycle.

## 1. Summary

Convert Tempo from a single shared workspace behind one passphrase into a set
of **private per-user workspaces behind passkey login**, for a small, known,
invite-only group. The owner adds people (email → one-time setup code); each
person registers a passkey on first login and uses it thereafter. No open
signup, no email sending, no billing in this cycle.

## 2. Current state

- Cloudflare Worker (vinext/React 19 RSC) + D1.
- One `workspaces` row, id `'solo'`, holding a JSON blob (`data`) and a
  `revision` integer for optimistic concurrency.
- Access gated by a single shared passphrase (`APP_PIN` secret), verified by
  an HMAC-signed session cookie (`lib/auth.ts`, `app/api/session/route.ts`).
- All app data flows through `GET`/`POST /api/workspace`, hard-coded to `'solo'`.

## 3. Goals / non-goals

**Goals**
- Each user has a private, isolated workspace. No user can read or write
  another user's data.
- Owner-only admin to add/list/remove members and (re)issue setup codes.
- Passkey (WebAuthn) registration and login; email is the identifier.
- One-time setup code gates first registration and recovery.
- Preserve the existing owner's current data.

**Non-goals (future cycles)**
- Stripe / billing / paywall.
- Open public self-signup.
- Email sending (verification, magic links, receipts).
- Password login.

## 4. Approach

Use **`@simplewebauthn/server`** (Workers-compatible, Web Crypto based) for the
security-critical WebAuthn ceremony verification, and hand-roll the rest
(users, credentials, sessions, admin, setup codes, tenant isolation) to fit the
existing minimal codebase, extending the HMAC-signed-cookie pattern already in
`lib/auth.ts`. Client uses `@simplewebauthn/browser`.

## 5. Data model (D1, via Drizzle)

- **`users`**: `id` (uuid, PK), `email` (text, unique, stored lowercased),
  `role` (`'owner' | 'member'`), `tokenVersion` (int, default 0),
  `createdAt` (int, epoch ms).
- **`credentials`**: `id` (text PK, base64url credential id), `userId` (FK),
  `publicKey` (text, base64url), `counter` (int), `transports` (text, JSON
  array), `createdAt`. A user may have multiple.
- **`setup_codes`**: `userId` (text PK — one active code per user),
  `codeHash` (text, SHA-256 of the code), `expiresAt` (int), `attempts`
  (int, default 0).
- **`workspaces`** (existing, re-keyed): `id` now holds a **user id** instead of
  the literal `'solo'`; `data` and `revision` unchanged. Seeded per user on
  first access.

## 6. Secrets / config (Worker)

- `AUTH_SECRET` — random, used to HMAC-sign session and challenge cookies and
  to derive code hashes. Replaces `APP_PIN`'s role.
- `OWNER_EMAIL` — the owner's email; only this address may bootstrap the owner.
- `OWNER_SETUP_CODE` — one-time code the owner uses to register the first
  passkey; unusable once an owner user exists.
- `rpID` / `rpName` — relying-party id is the host (`tempo.cillierd.workers.dev`
  in prod, `localhost` in dev); name is "Tempo". Derived from the request host.

## 7. Sessions & challenges (cookies)

- **Session** `tempo_session`: signed payload `{ userId, tokenVersion, exp }`,
  HMAC-SHA-256 with `AUTH_SECRET`, `HttpOnly; Secure; SameSite=Strict`,
  ~30-day expiry. A request is authenticated iff the signature verifies, it is
  unexpired, and `tokenVersion` matches the user's current `tokenVersion`.
- **Challenge** `tempo_challenge`: signed payload
  `{ challenge, email, purpose: 'register'|'login', exp (~5 min) }`. Issued by
  the `/options` endpoints, consumed and cleared by the `/verify` endpoints.
  Single-use.

## 8. Auth flows

1. **Owner bootstrap (once):** `email == OWNER_EMAIL`, no owner exists, and the
   submitted code `== OWNER_SETUP_CODE` → create owner user → passkey
   registration ceremony → session issued. Also runs the data migration (§11).
2. **Add member (owner):** owner submits an email → create `member` user
   (no credential yet) + generate a random **setup code** (stored hashed, 24h
   expiry) → return the code once to the owner to share out-of-band.
3. **Member first login / recovery:** email + setup code →
   `/api/auth/register/options` verifies the code (hash + not expired +
   `attempts` under limit), returns WebAuthn creation options and sets the
   challenge cookie → browser `startRegistration` →
   `/api/auth/register/verify` verifies attestation against the challenge,
   stores the credential, deletes the setup code, issues a session, seeds the
   workspace.
4. **Returning login:** email → `/api/auth/login/options` (user has ≥1
   credential) returns request options + challenge cookie → browser
   `startAuthentication` → `/api/auth/login/verify` verifies the assertion
   signature against the stored public key, checks/updates the signature
   counter, issues a session.
5. **Logout:** clear the session cookie.
6. **Recovery (lost device):** owner reissues a setup code for the member and
   bumps the member's `tokenVersion` (invalidating old sessions); the member
   registers a fresh passkey via flow 3.

## 9. Tenant isolation (security core)

- Every `/api/workspace` request resolves the workspace id **from the verified
  session's `userId` only**, never from any client-supplied value. There is no
  code path where a client can name another user's workspace.
- Admin routes require the session user's `role === 'owner'`.
- The optimistic-concurrency `revision` check is unchanged, now per user.
- Setup codes: 8-char unambiguous alphabet, hashed at rest, 24h expiry,
  invalidated after a small number of failed `attempts` (e.g., 5).
- Challenges are single-use and short-lived; signature counter regressions are
  rejected.

## 10. API routes

- `POST /api/auth/register/options` — body `{ email, code }`; owner bootstrap or
  member first-login/recovery; returns creation options, sets challenge cookie.
- `POST /api/auth/register/verify` — body = attestation response; stores
  credential, issues session.
- `POST /api/auth/login/options` — body `{ email }`; returns request options,
  sets challenge cookie.
- `POST /api/auth/login/verify` — body = assertion response; issues session.
- `POST /api/auth/logout` — clears session.
- `GET /api/auth/me` — `{ id, email, role }` or 401.
- `GET/POST/DELETE /api/admin/users` — owner-only: list; add (returns setup
  code); remove (deletes user + credentials + setup code + workspace);
  `POST …/reissue` regenerates a code and bumps `tokenVersion`.
- `GET/POST /api/workspace` — unchanged shape, now user-scoped; requires a
  valid session.
- **Removed:** `app/api/session/route.ts` and the `APP_PIN` gate.

## 11. Migration

- New Drizzle migration adds `users`, `credentials`, `setup_codes`.
- On owner bootstrap: if a `workspaces` row `id = 'solo'` exists and none exists
  for the owner's `userId`, copy its `data` + `revision` to a new row keyed by
  the owner's id (the existing data is preserved for the owner). The `'solo'`
  row is then left unused (or deleted).
- Remove `APP_PIN` usage; the whole app now sits behind per-user auth.
- Applied to local D1 (`wrangler d1 execute --local`) and remote
  (`--remote`) as in the existing workflow.

## 12. UI

- Replace `PinGate` with an **`AuthScreen`**: an email field that routes to
  either passkey login (returning user) or register-with-code (first
  login/recovery/owner bootstrap), driven by `@simplewebauthn/browser`. Clear
  error states (bad code, expired code, no passkey, cancelled ceremony).
- **`AdminPanel`** (owner-only, a new view or modal): list members with status
  (pending/active), add member (shows the setup code once), reissue code,
  remove member.
- The rest of the app (timer, entries, projects, reports, invoices) is
  unchanged and now reads/writes the logged-in user's workspace.
- The existing Logout button adapts to the new session endpoint.

## 13. Dependencies

- `@simplewebauthn/server` (verified to run in the Workers runtime — see §15).
- `@simplewebauthn/browser` (client helpers).

## 14. Testing

- **Unit:** session sign/verify + `tokenVersion` check; challenge cookie
  sign/verify/expiry/single-use; setup-code hashing, expiry, attempt limiting.
  (Extends `tests/` and the existing `auth.test` style.)
- **Integration (local dev, non-crypto paths):** admin add → code issued;
  `/options` endpoints gate correctly (bad/expired code rejected); **isolation
  — a session for user A can only ever reach user A's workspace**; owner-only
  enforcement on admin routes; logout + `tokenVersion` bump invalidates a
  session.
- **WebAuthn ceremony:** verified with the browser's virtual authenticator
  (WebAuthn devtools) plus a manual register→login→recover pass, since the
  ceremony needs a real authenticator.
- **Security review:** tenant isolation, code brute-forcing, challenge
  single-use, counter-regression rejection, owner bootstrap can't be re-run.

## 15. Risks & spikes

- **Spike first:** confirm `@simplewebauthn/server` runs cleanly in the
  Cloudflare Workers runtime before building on it. Fallback: a
  Workers-specific WebAuthn implementation if it doesn't.
- **Passkeys are domain-bound.** They register against
  `tempo.cillierd.workers.dev`. Moving to a custom domain later forces everyone
  to re-register. (Domain was intentionally settled first.)
- **Session revocation** is coarse (per-user `tokenVersion` bump). Adequate for
  a small trusted group; a per-session store could be added later if needed.
- **Local dev** uses `rpID = localhost` over `http://localhost`, which browsers
  permit for WebAuthn; production uses the real host over HTTPS.
