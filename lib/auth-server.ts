import { env } from 'cloudflare:workers';
import { getDatabase } from '@/db';
import {
  authCookie,
  hash,
  readCookie,
  signToken,
  verifyToken,
  SESSION_SECONDS,
} from '@/lib/auth';
export type AuthUser = {
  id: string;
  email: string;
  role: 'owner' | 'member';
  tokenVersion: number;
};
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function secret() {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
    throw new AuthError(
      'Sign-in is not configured yet. Contact the workspace owner.',
      503,
    );
  return env.AUTH_SECRET;
}
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === 'localhost' && url.protocol === 'http:')
    return url.origin;
  const configured = env.AUTH_ORIGIN || 'https://tempo.cillierd.workers.dev';
  if (url.origin !== configured || url.protocol !== 'https:')
    throw new AuthError('Sign in using Tempo’s configured address.', 403);
  return configured;
}
export function checkOrigin(request: Request) {
  const origin = requestOrigin(request);
  if (request.headers.get('origin') !== origin)
    throw new AuthError('Request origin is not allowed.', 403);
  return origin;
}
export function json(body: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 65536) throw new AuthError('Request too large.', 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new AuthError('Invalid request.');
  }
}
export async function requireUser(request: Request): Promise<AuthUser> {
  secret();
  requestOrigin(request);
  const p = await verifyToken(
    secret(),
    readCookie(request.headers.get('cookie')),
  );
  if (
    !p ||
    p.kind !== 'session' ||
    typeof p.userId !== 'string' ||
    typeof p.sid !== 'string'
  )
    throw new AuthError('Please sign in to your workspace.', 401);
  const user = await getDatabase()
    .prepare(
      'SELECT u.id,u.email,u.role,u.token_version AS tokenVersion FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE u.id=? AND s.id=? AND s.expires_at>?',
    )
    .bind(p.userId, await hash(p.sid), Date.now())
    .first<AuthUser>();
  if (!user || user.tokenVersion !== p.tokenVersion)
    throw new AuthError('Your session has expired. Please sign in again.', 401);
  return user;
}
export async function requireOwner(request: Request) {
  const user = await requireUser(request);
  if (user.role !== 'owner')
    throw new AuthError('Only the owner can manage members.', 403);
  return user;
}
export async function session(user: AuthUser, origin: string) {
  const sid = crypto.randomUUID(),
    exp = Date.now() + SESSION_SECONDS * 1000;
  const result = await getDatabase()
    .prepare(
      'INSERT INTO auth_sessions (id,user_id,expires_at) SELECT ?,id,? FROM users WHERE id=? AND token_version=?',
    )
    .bind(await hash(sid), exp, user.id, user.tokenVersion)
    .run();
  if (!result.meta.changes)
    throw new AuthError('Account access changed. Please sign in again.', 401);
  return authCookie(
    'tempo_session',
    await signToken(secret(), {
      kind: 'session',
      userId: user.id,
      tokenVersion: user.tokenVersion,
      sid,
      exp,
    }),
    SESSION_SECONDS,
    origin,
  );
}
export function fail(error: unknown, cookies: string[] = []) {
  if (error instanceof AuthError)
    return json(
      { error: error.message, authRequired: error.status === 401 },
      error.status,
      cookies,
    );
  console.error(
    'Tempo auth request failed:',
    error instanceof Error ? error.message : 'unknown error',
  );
  return json(
    { error: 'Could not complete sign-in. Please try again.' },
    500,
    cookies,
  );
}
export async function rateLimit(request: Request, scope: string, email = '') {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  const keys = [
    { id: await hash(`ip:${scope}:${ip}`), limit: 40 },
    { id: await hash(`email:${scope}:${email}`), limit: 12 },
  ];
  for (const key of keys) {
    const row = await getDatabase()
      .prepare(
        'INSERT INTO auth_limits(id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count',
      )
      .bind(key.id, now + 15 * 60 * 1000, now, now)
      .first<{ count: number }>();
    if (!row || row.count > key.limit)
      throw new AuthError('Too many attempts. Try again in 15 minutes.', 429);
  }
  await getDatabase().batch([
    getDatabase()
      .prepare('DELETE FROM auth_challenges WHERE expires_at<?')
      .bind(now),
    getDatabase()
      .prepare('DELETE FROM auth_sessions WHERE expires_at<?')
      .bind(now),
    getDatabase()
      .prepare('DELETE FROM auth_limits WHERE expires_at<?')
      .bind(now),
  ]);
}
