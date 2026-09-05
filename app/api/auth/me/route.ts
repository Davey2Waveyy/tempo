import { requireUser, json, fail } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const { id, email, role } = await requireUser(request);
    return json({ id, email, role });
  } catch (e) {
    return fail(e);
  }
}
