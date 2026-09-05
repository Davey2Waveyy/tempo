import { getDatabase } from '@/db';
import { authCookie, hash, readCookie, verifyToken } from '@/lib/auth';
import { checkOrigin, secret, json, fail } from '@/lib/auth-server';
export async function POST(request: Request) {
  try {
    const origin = checkOrigin(request);
    const p = await verifyToken(
      secret(),
      readCookie(request.headers.get('cookie')),
    );
    if (p?.kind === 'session' && typeof p.sid === 'string')
      await getDatabase()
        .prepare('DELETE FROM auth_sessions WHERE id=?')
        .bind(await hash(p.sid))
        .run();
    return json({ ok: true }, 200, [
      authCookie('tempo_session', '', 0, origin),
      authCookie('tempo_challenge', '', 0, origin),
    ]);
  } catch (e) {
    return fail(e);
  }
}
