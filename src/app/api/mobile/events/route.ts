import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { authenticateMobile } from '@/utils/mobileAuth';
import { applyClockEvents, type ClockEventInput } from '@/utils/clockEngine';

export const dynamic = 'force-dynamic';

const MAX_EVENTS_PER_REQUEST = 100;

/** Uploads a batch of clock events (IN / OUT / BREAK). Idempotent per event id. */
export async function POST(request: Request) {
  const auth = await authenticateMobile(request);
  if (!auth) return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });

  let body: { events?: ClockEventInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 });
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'Keine Ereignisse übergeben.' }, { status: 400 });
  }
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return NextResponse.json({ error: `Maximal ${MAX_EVENTS_PER_REQUEST} Ereignisse pro Anfrage.` }, { status: 413 });
  }

  const results = await applyClockEvents(auth.supabase, auth.user.id, events);

  if (results.some((r) => r.status === 'applied')) {
    revalidatePath('/dashboard');
  }

  return NextResponse.json({ results });
}
