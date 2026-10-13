/**
 * Shared time helpers (Europe/Berlin) used by server actions and the mobile API.
 */

/** Rounds a "HH:MM[:SS]" string to the nearest 15 minutes and returns "HH:MM:00". */
export function roundTimeTo15Min(timeStr: string): string {
  if (!timeStr) return timeStr;

  let [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;

  const roundedMinutes = Math.round(minutes / 15) * 15;

  if (roundedMinutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  } else {
    minutes = roundedMinutes;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/** Returns the Berlin local date ("YYYY-MM-DD") and time ("HH:MM:SS") for an instant. */
export function berlinParts(date: Date): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** Monday ("YYYY-MM-DD") of the week containing the given Berlin date string. */
export function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayFromMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayFromMonday);
  return d.toISOString().slice(0, 10);
}
