import { NextResponse } from 'next/server';
import { authenticateMobile } from '@/utils/mobileAuth';
import { getClockStatus } from '@/utils/clockEngine';

export const dynamic = 'force-dynamic';

/** Current clock state plus worked-time summary for the app and its widgets. */
export async function GET(request: Request) {
  const auth = await authenticateMobile(request);
  if (!auth) return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });

  try {
    const status = await getClockStatus(auth.supabase, auth.user.id);
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Status konnte nicht geladen werden.' },
      { status: 500 }
    );
  }
}
