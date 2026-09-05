// Web Crypto primitives shared by Workers handlers and isolated unit tests.
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array) {
  let value = '';
  for (const b of bytes) value += String.fromCharCode(b);
  return btoa(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
export function fromBase64url(value: string) {
  return Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  );
}
export async function hash(value: string) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(value)),
    ),
  );
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    ),
  );
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export async function signToken(
  secret: string,
  payload: Record<string, unknown>,
) {
  const data = base64url(encoder.encode(JSON.stringify(payload)));
  return `${data}.${await hmac(secret, data)}`;
}
export async function verifyToken(
  secret: string,
  token: string | null,
): Promise<Record<string, unknown> | null> {
  try {
    if (!token || token.length > 4096) return null;
    const [data, sig, extra] = token.split('.');
    if (extra || !data || !sig || !safeEqual(sig, await hmac(secret, data)))
      return null;
    const p = JSON.parse(new TextDecoder().decode(fromBase64url(data)));
    return typeof p === 'object' &&
      p &&
      Number.isFinite(p.exp) &&
      p.exp > Date.now()
      ? p
      : null;
  } catch {
    return null;
  }
}
export function readCookie(header: string | null, name = 'tempo_session') {
  try {
    for (const part of (header || '').split(';')) {
      const at = part.indexOf('=');
      if (part.slice(0, at).trim() === name)
        return decodeURIComponent(part.slice(at + 1).trim());
    }
  } catch {}
  return null;
}
export function authCookie(
  name: string,
  value: string,
  seconds: number,
  origin: string,
) {
  const secure = new URL(origin).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${seconds}`;
}
export function normalizeEmail(value: unknown) {
  if (typeof value !== 'string')
    throw new Error('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address.');
  return email;
}
export function generateSetupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
export function normalizeCode(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/[\s-]/g, '').toUpperCase().slice(0, 128)
    : '';
}
export async function setupHash(secret: string, userId: string, code: string) {
  return hmac(secret, `setup:${userId}:${normalizeCode(code)}`);
}
