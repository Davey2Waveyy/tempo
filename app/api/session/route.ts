import { env } from 'cloudflare:workers';
import {
  clearCookie,
  createSession,
  sessionCookie,
  verifyPin,
} from '@/lib/auth';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
// Lets the client know whether to present the passphrase gate.
export function GET() {
  return Response.json({ authRequired: Boolean(env.APP_PIN) }, { headers });
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: 'Request origin is not allowed.' },
      { status: 403, headers },
    );
  const pin = env.APP_PIN;
  if (!pin) return Response.json({ ok: true }, { headers }); // gate disabled
  let input: unknown;
  try {
    input = JSON.parse(await request.text());
  } catch {
    input = {};
  }
  const candidate = (input as { pin?: unknown } | null)?.pin;
  if (!(await verifyPin(candidate, pin))) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // slow guessing
    return Response.json(
      { error: 'Incorrect passphrase.' },
      { status: 401, headers },
    );
  }
  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: { ...headers, 'Set-Cookie': sessionCookie(await createSession(pin)) },
    },
  );
}
export function DELETE() {
  return Response.json(
    { ok: true },
    { headers: { ...headers, 'Set-Cookie': clearCookie() } },
  );
}
