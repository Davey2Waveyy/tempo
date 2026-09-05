// Server-side passphrase gate for the Tempo Worker. Runs only in the Cloudflare
// Workers runtime (never on the client) and relies on Web Crypto. The gate is
// active only when the APP_PIN secret is configured; with no secret the
// workspace stays open, exactly as it behaved before a passphrase was set.

const COOKIE_NAME = 'tempo_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message),
  );
  return base64url(new Uint8Array(signature));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64url(new Uint8Array(digest));
}

// Constant-time comparison of equal-length strings; avoids leaking how far a
// value matched via response timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function readCookie(
  header: string | null,
  name = COOKIE_NAME,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

// A session token is `<expiry>.<hmac(pin, expiry)>`: unforgeable without the
// passphrase and self-expiring. Changing the passphrase invalidates every
// previously issued token.
export async function createSession(pin: string): Promise<string> {
  const expiry = String(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
  return `${expiry}.${await hmac(pin, expiry)}`;
}

export async function isValidSession(
  cookieHeader: string | null,
  pin: string,
): Promise<boolean> {
  const token = readCookie(cookieHeader);
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const expiry = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, await hmac(pin, expiry))) return false;
  const seconds = Number(expiry);
  return Number.isFinite(seconds) && seconds > Math.floor(Date.now() / 1000);
}

// Compare fixed-length hashes so neither timing nor length reveals the secret.
export async function verifyPin(input: unknown, pin: string): Promise<boolean> {
  if (typeof input !== 'string' || input.length === 0 || input.length > 256)
    return false;
  return safeEqual(await sha256(input), await sha256(pin));
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
