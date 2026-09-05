import { getDatabase } from '@/db';
import { normalizeEmail, generateSetupCode, setupHash } from '@/lib/auth';
import {
  requireOwner,
  checkOrigin,
  body,
  json,
  fail,
  secret,
  AuthError,
} from '@/lib/auth-server';
export async function listUsers(request: Request) {
  try {
    await requireOwner(request);
    const rows = await getDatabase()
      .prepare(
        'SELECT u.id,u.email,u.role,u.created_at AS createdAt,(SELECT count(*) FROM credentials c WHERE c.user_id=u.id) AS passkeys,(SELECT expires_at FROM setup_codes sc WHERE sc.user_id=u.id) AS codeExpiresAt FROM users u ORDER BY u.created_at',
      )
      .all();
    return json({ users: rows.results });
  } catch (e) {
    return fail(e);
  }
}
export async function addUser(request: Request) {
  try {
    checkOrigin(request);
    await requireOwner(request);
    const input = await body(request),
      email = normalizeEmail(input.email);
    const db = getDatabase();
    if (
      await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()
    )
      throw new AuthError(
        'That email already has an account. Use a new setup code for recovery.',
        409,
      );
    const id = crypto.randomUUID(),
      code = generateSetupCode(),
      now = Date.now();
    await db.batch([
      db
        .prepare(
          "INSERT INTO users(id,email,role,token_version,created_at) VALUES (?,?,'member',0,?)",
        )
        .bind(id, email, now),
      db
        .prepare(
          'INSERT INTO setup_codes(user_id,code_hash,expires_at,attempts) VALUES (?,?,?,0)',
        )
        .bind(id, await setupHash(secret(), id, code), now + 86400000),
    ]);
    return json({ id, email, code, expiresAt: now + 86400000 }, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function removeUser(request: Request) {
  try {
    checkOrigin(request);
    await requireOwner(request);
    const { id } = await body(request);
    if (typeof id !== 'string') throw new AuthError('Choose a member.');
    const db = getDatabase();
    const user = await db
      .prepare("SELECT id FROM users WHERE id=? AND role='member'")
      .bind(id)
      .first();
    if (!user) throw new AuthError('Only member accounts can be removed.', 400);
    await db.batch([
      db
        .prepare(
          "DELETE FROM workspaces WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='member')",
        )
        .bind(id, id),
      db.prepare("DELETE FROM users WHERE id=? AND role='member'").bind(id),
    ]);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
export async function reissueCode(request: Request) {
  try {
    checkOrigin(request);
    await requireOwner(request);
    const { id } = await body(request);
    if (typeof id !== 'string') throw new AuthError('Choose a member.');
    const db = getDatabase();
    const member = await db
      .prepare("SELECT id,email FROM users WHERE id=? AND role='member'")
      .bind(id)
      .first<{ id: string; email: string }>();
    if (!member) throw new AuthError('Choose an existing member.', 404);
    const code = generateSetupCode(),
      expiresAt = Date.now() + 86400000;
    await db.batch([
      db
        .prepare(
          "UPDATE users SET token_version=token_version+1 WHERE id=? AND role='member'",
        )
        .bind(id),
      db.prepare('DELETE FROM credentials WHERE user_id=?').bind(id),
      db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(id),
      db.prepare('DELETE FROM auth_challenges WHERE user_id=?').bind(id),
      db
        .prepare(
          'INSERT INTO setup_codes(user_id,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0',
        )
        .bind(id, await setupHash(secret(), id, code), expiresAt),
    ]);
    return json({ email: member.email, code, expiresAt });
  } catch (e) {
    return fail(e);
  }
}
