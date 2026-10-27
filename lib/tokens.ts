import { getDatabase } from '@/db';
import { generateApiToken, hash } from '@/lib/auth';
import {
  requireUser,
  checkOrigin,
  body,
  json,
  fail,
  AuthError,
  type AuthUser,
} from '@/lib/auth-server';
// Agent tokens are managed only from an interactive browser session, never
// with an agent token itself — a leaked token cannot mint more tokens, list
// its siblings, or revoke the ones that would lock it out.
async function requireSession(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.viaToken)
    throw new AuthError(
      'Manage agent access from a signed-in browser session.',
      403,
    );
  return user;
}
const MAX_TOKENS = 20;
export async function listTokens(request: Request) {
  try {
    const user = await requireSession(request);
    const rows = await getDatabase()
      .prepare(
        'SELECT id,name,prefix,created_at AS createdAt,last_used_at AS lastUsedAt FROM api_tokens WHERE user_id=? ORDER BY created_at DESC',
      )
      .bind(user.id)
      .all();
    return json({ tokens: rows.results });
  } catch (e) {
    return fail(e);
  }
}
export async function createToken(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireSession(request);
    const input = await body(request);
    const name =
      typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
    if (!name) throw new AuthError('Name this token so you can recognize it.');
    const db = getDatabase();
    const count = await db
      .prepare('SELECT count(*) AS n FROM api_tokens WHERE user_id=?')
      .bind(user.id)
      .first<{ n: number }>();
    if (count && count.n >= MAX_TOKENS)
      throw new AuthError(
        'Token limit reached. Revoke one before creating another.',
        409,
      );
    const token = generateApiToken(),
      id = crypto.randomUUID(),
      prefix = token.slice(0, 12),
      now = Date.now();
    await db
      .prepare(
        'INSERT INTO api_tokens (id,user_id,name,prefix,token_hash,created_at,last_used_at) VALUES (?,?,?,?,?,?,NULL)',
      )
      .bind(id, user.id, name, prefix, await hash(token), now)
      .run();
    return json({ id, name, prefix, token, createdAt: now }, 201);
  } catch (e) {
    return fail(e);
  }
}
export async function revokeToken(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireSession(request);
    const { id } = await body(request);
    if (typeof id !== 'string')
      throw new AuthError('Choose a token to revoke.');
    const result = await getDatabase()
      .prepare('DELETE FROM api_tokens WHERE id=? AND user_id=?')
      .bind(id, user.id)
      .run();
    if (!result.meta.changes)
      throw new AuthError('That token no longer exists.', 404);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
