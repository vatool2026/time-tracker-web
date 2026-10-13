import type { SupabaseClient } from '@supabase/supabase-js';
import { berlinParts, roundTimeTo15Min, weekStartOf } from '@/utils/timeUtils';
import { calculateSurcharges, type SurchargeSettings } from '@/utils/surchargeCalculator';

export type ClockEventType = 'IN' | 'OUT' | 'BREAK';

export interface ClockEventInput {
  /** Client-generated UUID; makes retries idempotent. */
  id: string;
  type: ClockEventType;
  /** When the user actually pressed the button (ISO 8601, device clock). */
  at: string;
  /** Optional explicit wall-clock time "HH:MM" (Berlin) chosen by the user ("Zeit nachtragen"). */
  time?: string;
  note?: string;
  /** BREAK only. */
  minutes?: number;
  startIso?: string;
  endIso?: string;
  /** True if the event was queued while the device had no connection. */
  recordedOffline?: boolean;
}

export type ClockEventStatus = 'applied' | 'duplicate' | 'rejected' | 'error';

export interface ClockEventResult {
  id: string;
  status: ClockEventStatus;
  message?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const MAX_FUTURE_MS = 5 * 60 * 1000;

function withSeconds(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

async function findActiveEntry(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, entry_date, start_time, note, break_minutes, break_logs')
    .eq('user_id', userId)
    .is('end_time', null)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

function validate(event: ClockEventInput): string | null {
  if (!event || typeof event.id !== 'string' || !UUID_RE.test(event.id)) return 'Ungültige Ereignis-ID.';
  if (!['IN', 'OUT', 'BREAK'].includes(event.type)) return 'Ungültiger Ereignistyp.';
  const at = new Date(event.at);
  if (isNaN(at.getTime())) return 'Ungültiger Zeitstempel.';
  if (at.getTime() > Date.now() + MAX_FUTURE_MS) return 'Der Zeitstempel liegt in der Zukunft (Uhr des Geräts prüfen).';
  if (event.time !== undefined && !TIME_RE.test(event.time)) return 'Ungültige Uhrzeit.';
  if (event.type === 'BREAK') {
    if (!Number.isFinite(event.minutes) || (event.minutes as number) < 1 || (event.minutes as number) > 600) {
      return 'Ungültige Pausendauer.';
    }
  }
  return null;
}

async function applyOne(
  supabase: SupabaseClient,
  userId: string,
  event: ClockEventInput
): Promise<{ status: 'applied' | 'rejected'; message?: string; entryId?: string }> {
  const at = new Date(event.at);
  const parts = berlinParts(at);

  if (event.type === 'IN') {
    const { data: existing, error: checkError } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('entry_date', parts.date)
      .is('end_time', null)
      .is('deleted_at', null);
    if (checkError) throw new Error(checkError.message);
    if (existing && existing.length > 0) return { status: 'rejected', message: 'Sie sind bereits eingestempelt.' };

    const startTime = event.time ? withSeconds(event.time) : roundTimeTo15Min(parts.time.slice(0, 5));
    const { data: inserted, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: userId,
        entry_date: parts.date,
        start_time: startTime,
        break_minutes: 0,
        note: event.note || null,
        recorded_offline: !!event.recordedOffline,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { status: 'applied', entryId: inserted.id };
  }

  const active = await findActiveEntry(supabase, userId);
  if (!active) {
    return {
      status: 'rejected',
      message:
        event.type === 'OUT'
          ? 'Kein aktiver Zeiteintrag zum Ausstempeln gefunden.'
          : 'Kein aktiver Zeiteintrag gefunden. Pause kann nur im eingestempelten Zustand erfasst werden.',
    };
  }

  if (event.type === 'OUT') {
    const endTime = event.time ? withSeconds(event.time) : roundTimeTo15Min(parts.time.slice(0, 5));
    // Same-day shift ending before it started is a typo; overnight shifts have a later calendar date.
    if (event.time && parts.date === active.entry_date && endTime < active.start_time) {
      return { status: 'rejected', message: 'Die Endzeit liegt vor der Startzeit.' };
    }
    const updatedNote = event.note ? (active.note ? `${active.note} | ${event.note}` : event.note) : active.note;
    const { error } = await supabase
      .from('time_entries')
      .update({ end_time: endTime, note: updatedNote })
      .eq('id', active.id);
    if (error) throw new Error(error.message);
    return { status: 'applied', entryId: active.id };
  }

  // BREAK
  const minutes = Math.round(event.minutes as number);
  const logs = Array.isArray(active.break_logs) ? [...active.break_logs] : [];
  logs.push(
    event.startIso && event.endIso
      ? { start: event.startIso, end: event.endIso, minutes, event_id: event.id }
      : { minutes, event_id: event.id }
  );
  const { error } = await supabase
    .from('time_entries')
    .update({ break_minutes: (active.break_minutes || 0) + minutes, break_logs: logs })
    .eq('id', active.id);
  if (error) throw new Error(error.message);
  return { status: 'applied', entryId: active.id };
}

/**
 * Applies a batch of clock events in chronological order. Safe to call repeatedly with the same
 * events: events that were already processed are reported as "duplicate".
 */
export async function applyClockEvents(
  supabase: SupabaseClient,
  userId: string,
  events: ClockEventInput[]
): Promise<ClockEventResult[]> {
  const ordered = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const results = new Map<string, ClockEventResult>();

  for (const event of ordered) {
    const invalid = validate(event);
    if (invalid) {
      results.set(event?.id ?? 'unknown', { id: event?.id ?? 'unknown', status: 'rejected', message: invalid });
      continue;
    }

    // Claim the event id first; a unique violation means it was already processed.
    const { error: claimError } = await supabase.from('clock_events').insert({
      id: event.id,
      user_id: userId,
      type: event.type,
      occurred_at: new Date(event.at).toISOString(),
      source: 'android',
    });
    if (claimError) {
      if (claimError.code === '23505') {
        results.set(event.id, { id: event.id, status: 'duplicate' });
      } else {
        results.set(event.id, { id: event.id, status: 'error', message: claimError.message });
      }
      continue;
    }

    try {
      const outcome = await applyOne(supabase, userId, event);
      if (outcome.status === 'applied') {
        if (outcome.entryId) {
          await supabase.from('clock_events').update({ time_entry_id: outcome.entryId }).eq('id', event.id);
        }
        results.set(event.id, { id: event.id, status: 'applied' });
      } else {
        await supabase.from('clock_events').delete().eq('id', event.id);
        results.set(event.id, { id: event.id, status: 'rejected', message: outcome.message });
      }
    } catch (err) {
      // Release the claim so the client can retry later.
      await supabase.from('clock_events').delete().eq('id', event.id);
      results.set(event.id, {
        id: event.id,
        status: 'error',
        message: err instanceof Error ? err.message : 'Unbekannter Fehler.',
      });
    }
  }

  // Keep the order the client sent.
  return events.map((e) => results.get(e?.id) ?? { id: e?.id ?? 'unknown', status: 'rejected', message: 'Nicht verarbeitet.' });
}

export interface ClockStatus {
  user: { firstName: string; lastName: string };
  active: {
    id: string;
    entryDate: string;
    startTime: string;
    breakMinutes: number;
    note: string | null;
  } | null;
  /** Finished entries only, in minutes. The running entry is added by the client. */
  today: { workedMinutes: number };
  week: { workedMinutes: number };
  month: { workedMinutes: number };
  serverTime: string;
}

/** Summary for the app/widgets: current state plus finished worked time for today/week/month. */
export async function getClockStatus(supabase: SupabaseClient, userId: string): Promise<ClockStatus> {
  const now = berlinParts(new Date());
  const monthStart = `${now.date.slice(0, 7)}-01`;
  const weekStart = weekStartOf(now.date);
  const rangeStart = weekStart < monthStart ? weekStart : monthStart;

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, company_id, employment_category')
    .eq('id', userId)
    .single();

  let settings: SurchargeSettings = {
    night_surcharge_start_time: '22:00:00',
    night_surcharge_end_time: '06:00:00',
    night_surcharge_rate: 25,
    sunday_surcharge_rate: 50,
    holiday_surcharge_rate: 100,
  };
  if (profile?.company_id && profile?.employment_category) {
    const { data: cat } = await supabase
      .from('category_settings')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('category', profile.employment_category)
      .maybeSingle();
    if (cat) settings = cat as SurchargeSettings;
  }

  const { data: entries } = await supabase
    .from('time_entries')
    .select('id, entry_date, start_time, end_time, break_minutes, break_logs, absence_code, note')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('entry_date', rangeStart)
    .lte('entry_date', now.date);

  let today = 0;
  let week = 0;
  let month = 0;
  let active: ClockStatus['active'] = null;

  for (const e of entries ?? []) {
    if (!e.end_time) {
      if (!active) {
        active = {
          id: e.id,
          entryDate: e.entry_date,
          startTime: e.start_time,
          breakMinutes: e.break_minutes || 0,
          note: e.note ?? null,
        };
      }
      continue;
    }
    if (e.absence_code) continue;
    const calc = calculateSurcharges(e.entry_date, e.start_time, e.end_time, e.break_minutes || 0, settings, undefined, undefined, e.break_logs);
    const minutes = Math.round((calc.workedHoursDay1 + calc.workedHoursDay2) * 60);
    if (e.entry_date === now.date) today += minutes;
    if (e.entry_date >= weekStart) week += minutes;
    if (e.entry_date >= monthStart) month += minutes;
  }

  // An older still-open entry (forgotten clock-out) must also count as "active".
  if (!active) {
    const open = await findActiveEntry(supabase, userId);
    if (open) {
      active = {
        id: open.id,
        entryDate: open.entry_date,
        startTime: open.start_time,
        breakMinutes: open.break_minutes || 0,
        note: open.note ?? null,
      };
    }
  }

  return {
    user: { firstName: profile?.first_name ?? '', lastName: profile?.last_name ?? '' },
    active,
    today: { workedMinutes: today },
    week: { workedMinutes: week },
    month: { workedMinutes: month },
    serverTime: new Date().toISOString(),
  };
}
