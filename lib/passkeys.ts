import { env } from 'cloudflare:workers';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { getDatabase } from '@/db';
import {
  authCookie,
  base64url,
  fromBase64url,
  hmac,
  normalizeCode,
  normalizeEmail,
  readCookie,
  safeEqual,
  setupHash,
  signToken,
  verifyToken,
} from '@/lib/auth';
import {
  AuthError,
  body,
  checkOrigin,
  fail,
  json,
  rateLimit,
  secret,
  session,
  type AuthUser,
} from '@/lib/auth-server';
type Challenge = {
  id: string;
  user_id: string;
  challenge: string;
  purpose: string;
  origin: string;
  rp_id: string;
  token_version: number;
  code_hash: string | null;
  expires_at: number;
};
type Credential = {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string;
};
const db = () => getDatabase();
const getUser = (email: string) =>
  db()
    .prepare(
      'SELECT id,email,role,token_version AS tokenVersion FROM users WHERE email=?',
    )
    .bind(email)
    .first<AuthUser>();
async function saveChallenge(
  user: AuthUser,
  purpose: string,
  challenge: string,
  origin: string,
  codeHash: string | null,
) {
  const id = crypto.randomUUID(),
    exp = Date.now() + 5 * 60 * 1000;
  await db()
    .prepare(
      'INSERT INTO auth_challenges (id,user_id,challenge,purpose,origin,rp_id,token_version,code_hash,expires_at) VALUES (?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      user.id,
      challenge,
      purpose,
      origin,
      new URL(origin).hostname,
      user.tokenVersion,
      codeHash,
      exp,
    )
    .run();
  return authCookie(
    'tempo_challenge',
    await signToken(secret(), {
      kind: 'challenge',
      id,
      userId: user.id,
      purpose,
      exp,
    }),
    300,
    origin,
  );
}
async function consumeChallenge(
  request: Request,
  purpose: string,
  origin: string,
) {
  const token = await verifyToken(
    secret(),
    readCookie(request.headers.get('cookie'), 'tempo_challenge'),
  );
  if (
    !token ||
    token.kind !== 'challenge' ||
    token.purpose !== purpose ||
    typeof token.id !== 'string'
  )
    throw new AuthError(
      'This sign-in attempt expired. Please start again.',
      401,
    );
  const c = await db()
    .prepare(
      'DELETE FROM auth_challenges WHERE id=? AND user_id=? AND purpose=? AND origin=? AND expires_at>? RETURNING *',
    )
    .bind(token.id, token.userId, purpose, origin, Date.now())
    .first<Challenge>();
  if (!c)
    throw new AuthError(
      'This sign-in attempt was already used or expired. Please start again.',
      401,
    );
  return c;
}
async function registrationUser(email: string, code: string) {
  let user = await getUser(email);
  if (!user) {
    const ownerEmail = env.OWNER_EMAIL ? normalizeEmail(env.OWNER_EMAIL) : '';
    const bootstrap = env.OWNER_SETUP_CODE;
    if (
      email !== ownerEmail ||
      !bootstrap ||
      !safeEqual(
        await hmac(secret(), normalizeCode(code)),
        await hmac(secret(), normalizeCode(bootstrap)),
      )
    )
      throw new AuthError(
        'The email or setup code is invalid, expired, or locked. Ask the owner for a new code.',
        401,
      );
    const id = crypto.randomUUID(),
      now = Date.now();
    await db().batch([
      db()
        .prepare(
          "INSERT OR IGNORE INTO users (id,email,role,token_version,created_at) SELECT ?,?,'owner',0,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='owner')",
        )
        .bind(id, email, now),
      db()
        .prepare(
          'INSERT OR IGNORE INTO setup_codes (user_id,code_hash,expires_at,attempts) SELECT id,?,?,0 FROM users WHERE id=?',
        )
        .bind(await setupHash(secret(), id, code), now + 86400000, id),
    ]);
    user = await getUser(email);
  }
  if (!user)
    throw new AuthError(
      'Account setup is unavailable. Ask the owner for a new code.',
      401,
    );
  // Every submitted code consumes one of five attempts, atomically, even when correct.
  const pending = await db()
    .prepare(
      'UPDATE setup_codes SET attempts=attempts+1 WHERE user_id=? AND expires_at>? AND attempts<5 RETURNING code_hash',
    )
    .bind(user.id, Date.now())
    .first<{ code_hash: string }>();
  const codeHash = await setupHash(secret(), user.id, code);
  if (!pending || !safeEqual(pending.code_hash, codeHash))
    throw new AuthError(
      'The email or setup code is invalid, expired, or locked. Ask the owner for a new code.',
      401,
    );
  return { user, codeHash };
}
export async function registerOptions(request: Request) {
  try {
    const origin = checkOrigin(request);
    secret();
    const input = await body(request),
      email = normalizeEmail(input.email);
    await rateLimit(request, 'register', email);
    const { user, codeHash } = await registrationUser(
      email,
      normalizeCode(input.code),
    );
    const existing = await db()
      .prepare('SELECT id FROM credentials WHERE user_id=?')
      .bind(user.id)
      .all<{ id: string }>();
    const options = await generateRegistrationOptions({
      rpName: 'Tempo',
      rpID: new URL(origin).hostname,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: existing.results.map((c) => ({ id: c.id })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    return json(options, 200, [
      await saveChallenge(
        user,
        'register',
        options.challenge,
        origin,
        codeHash,
      ),
    ]);
  } catch (e) {
    return fail(e);
  }
}
export async function registerVerify(request: Request) {
  let cookies: string[] = [];
  try {
    const origin = checkOrigin(request);
    secret();
    cookies = [authCookie('tempo_challenge', '', 0, origin)];
    const c = await consumeChallenge(request, 'register', origin);
    const response = (await body(request)) as RegistrationResponseJSON;
    let result;
    try {
      result = await verifyRegistrationResponse({
        response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rp_id,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch {
      throw new AuthError(
        'Passkey verification failed. Please start again.',
        400,
      );
    }
    if (!result.verified || !result.registrationInfo)
      throw new AuthError('Passkey verification failed.', 400);
    const { credential } = result.registrationInfo;
    const rows = await db().batch([
      db()
        .prepare(
          'INSERT INTO credentials (id,user_id,public_key,counter,transports,created_at) SELECT ?,u.id,?,?,?,? FROM users u JOIN setup_codes sc ON sc.user_id=u.id WHERE u.id=? AND u.token_version=? AND sc.code_hash=? AND sc.expires_at>? AND sc.attempts<=5',
        )
        .bind(
          credential.id,
          base64url(credential.publicKey),
          credential.counter,
          JSON.stringify(credential.transports || []),
          Date.now(),
          c.user_id,
          c.token_version,
          c.code_hash,
          Date.now(),
        ),
      db()
        .prepare(
          'DELETE FROM setup_codes WHERE user_id=? AND code_hash=? AND EXISTS (SELECT 1 FROM credentials WHERE id=? AND user_id=?)',
        )
        .bind(c.user_id, c.code_hash, credential.id, c.user_id),
      db()
        .prepare(
          "INSERT OR IGNORE INTO workspaces (id,data,revision) SELECT u.id,w.data,w.revision FROM workspaces w JOIN users u ON u.id=? AND u.role='owner' WHERE w.id='solo' AND EXISTS (SELECT 1 FROM credentials WHERE id=? AND user_id=u.id)",
        )
        .bind(c.user_id, credential.id),
    ]);
    if (!rows[0].meta.changes)
      throw new AuthError(
        'This setup code was replaced or used. Ask for a new code.',
        401,
      );
    const user = await db()
      .prepare(
        'SELECT id,email,role,token_version AS tokenVersion FROM users WHERE id=? AND token_version=?',
      )
      .bind(c.user_id, c.token_version)
      .first<AuthUser>();
    if (!user)
      throw new AuthError('Account access changed. Please start again.', 401);
    cookies.push(await session(user, origin));
    return json(
      { ok: true, user: { id: user.id, email: user.email, role: user.role } },
      200,
      cookies,
    );
  } catch (e) {
    return fail(e, cookies);
  }
}
export async function loginOptions(request: Request) {
  try {
    const origin = checkOrigin(request);
    secret();
    const input = await body(request),
      email = normalizeEmail(input.email);
    await rateLimit(request, 'login', email);
    const user = await getUser(email);
    const credentials = user
      ? await db()
          .prepare('SELECT id,transports FROM credentials WHERE user_id=?')
          .bind(user.id)
          .all<Credential>()
      : null;
    if (!user || !credentials?.results.length)
      throw new AuthError(
        'No passkey is available. Use a setup code or contact the owner.',
        401,
      );
    const options = await generateAuthenticationOptions({
      rpID: new URL(origin).hostname,
      userVerification: 'required',
      allowCredentials: credentials.results.map((c) => ({
        id: c.id,
        transports: JSON.parse(c.transports) as AuthenticatorTransportFuture[],
      })),
    });
    return json(options, 200, [
      await saveChallenge(user, 'login', options.challenge, origin, null),
    ]);
  } catch (e) {
    return fail(e);
  }
}
export async function loginVerify(request: Request) {
  let cookies: string[] = [];
  try {
    const origin = checkOrigin(request);
    secret();
    cookies = [authCookie('tempo_challenge', '', 0, origin)];
    const c = await consumeChallenge(request, 'login', origin);
    const response = (await body(request)) as AuthenticationResponseJSON;
    const credential =
      typeof response.id === 'string'
        ? await db()
            .prepare('SELECT * FROM credentials WHERE id=? AND user_id=?')
            .bind(response.id, c.user_id)
            .first<Credential>()
        : null;
    if (!credential)
      throw new AuthError('This passkey is not valid for this account.', 401);
    if (
      response.response?.userHandle &&
      response.response.userHandle !==
        base64url(new TextEncoder().encode(c.user_id))
    )
      throw new AuthError('This passkey is not valid for this account.', 401);
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rp_id,
        credential: {
          id: credential.id,
          publicKey: fromBase64url(credential.public_key),
          counter: credential.counter,
          transports: JSON.parse(credential.transports),
        },
        requireUserVerification: true,
      });
    } catch {
      throw new AuthError(
        'Passkey verification failed. Please try again or recover your account.',
        401,
      );
    }
    if (!result.verified)
      throw new AuthError('Passkey verification failed.', 401);
    const updated = await db()
      .prepare(
        'UPDATE credentials SET counter=? WHERE id=? AND user_id=? AND counter=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND token_version=?)',
      )
      .bind(
        result.authenticationInfo.newCounter,
        credential.id,
        c.user_id,
        credential.counter,
        c.user_id,
        c.token_version,
      )
      .run();
    if (!updated.meta.changes)
      throw new AuthError('Account access changed. Please sign in again.', 401);
    const user = await db()
      .prepare(
        'SELECT id,email,role,token_version AS tokenVersion FROM users WHERE id=? AND token_version=?',
      )
      .bind(c.user_id, c.token_version)
      .first<AuthUser>();
    if (!user) throw new AuthError('Please sign in again.', 401);
    cookies.push(await session(user, origin));
    return json(
      { ok: true, user: { id: user.id, email: user.email, role: user.role } },
      200,
      cookies,
    );
  } catch (e) {
    return fail(e, cookies);
  }
}
