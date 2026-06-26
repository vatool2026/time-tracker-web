/**
 * Utility to calculate German public holidays (Bundesweite Feiertage).
 * Uses Gauss's Easter Algorithm to determine moving Christian holidays.
 */

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = year % 4;
  const c = year % 7;
  const k = Math.floor(year / 100);
  const p = Math.floor((13 + 8 * k) / 25);
  const q = Math.floor(k / 4);
  const M = (15 - p + k - q) % 30;
  const N = (4 + k - q) % 7;
  const d = (19 * a + M) % 30;
  const e = (2 * b + 4 * c + 6 * d + N) % 7;
  
  let day = 22 + d + e;
  let month = 2; // March (0-indexed in JS Date is 2)
  
  if (day > 31) {
    month = 3; // April (3 in JS Date)
    day = day - 31;
  }

  // Gauss exceptions
  if (month === 3 && day === 26) {
    day = 19;
  }
  if (month === 3 && day === 25 && d === 28 && e === 6 && a > 10) {
    day = 18;
  }

  // Create date in UTC to avoid local timezone issues
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns a map of YYYY-MM-DD to Holiday Name for a given year.
 */
export function getGermanHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  // 1. Fixed holidays
  holidays.set(`${year}-01-01`, 'Neujahr');
  holidays.set(`${year}-05-01`, 'Tag der Arbeit');
  holidays.set(`${year}-10-03`, 'Tag der Deutschen Einheit');
  holidays.set(`${year}-12-25`, '1. Weihnachtstag');
  holidays.set(`${year}-12-26`, '2. Weihnachtstag');

  // 2. Variable holidays based on Easter Sunday
  const easterSunday = getEasterSunday(year);
  
  const karfreitag = addDays(easterSunday, -2);
  const ostermontag = addDays(easterSunday, 1);
  const christiHimmelfahrt = addDays(easterSunday, 39);
  const pfingstmontag = addDays(easterSunday, 50);
  const fronleichnam = addDays(easterSunday, 60); // Common in many states

  holidays.set(formatDateKey(karfreitag), 'Karfreitag');
  holidays.set(formatDateKey(ostermontag), 'Ostermontag');
  holidays.set(formatDateKey(christiHimmelfahrt), 'Christi Himmelfahrt');
  holidays.set(formatDateKey(pfingstmontag), 'Pfingstmontag');
  holidays.set(formatDateKey(fronleichnam), 'Fronleichnam');

  return holidays;
}

/**
 * Checks if a given date is a German public holiday.
 * The input date is interpreted in local or UTC depending on formatting,
 * but compared as YYYY-MM-DD.
 */
export function isGermanHoliday(date: Date | string): { isHoliday: boolean; name?: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  
  // Format as local YYYY-MM-DD for matching
  const localYear = d.getFullYear();
  const localMonth = String(d.getMonth() + 1).padStart(2, '0');
  const localDay = String(d.getDate()).padStart(2, '0');
  const dateKey = `${localYear}-${localMonth}-${localDay}`;

  const holidays = getGermanHolidays(year);
  const name = holidays.get(dateKey);

  return {
    isHoliday: !!name,
    name,
  };
}
