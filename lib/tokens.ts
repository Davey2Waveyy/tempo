import { apiTokenFor } from '@/lib/auth';
import {
  requireUser,
  json,
  fail,
  secret,
  AuthError,
  type AuthUser,
} from '@/lib/auth-server';
// The agent key is managed only from an interactive browser session — an agent
// token cannot read or rotate itself.
async function requireSession(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.viaToken)
    throw new AuthError(
      'Open Agent access from a signed-in browser session.',
      403,
    );
  return user;
}
// Returns the caller's own agent key. It is derived, not stored, so it is
// stable until the user's tokenVersion changes (e.g. an owner resetting a
// member) or AUTH_SECRET is rotated.
export async function getToken(request: Request) {
  try {
    const user = await requireSession(request);
    return json({
      token: await apiTokenFor(secret(), user.id, user.tokenVersion),
    });
  } catch (e) {
    return fail(e);
  }
}
