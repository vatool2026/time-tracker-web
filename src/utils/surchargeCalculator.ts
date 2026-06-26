import { isGermanHoliday } from './holidays';

export interface SurchargeSettings {
  night_surcharge_start_time: string; // e.g. "22:00:00"
  night_surcharge_rate: number;       // e.g. 25.0 (%)
  sunday_surcharge_start_time: string;// e.g. "00:00:00"
  sunday_surcharge_rate: number;      // e.g. 50.0 (%)
  holiday_surcharge_start_time: string;// e.g. "00:00:00"
  holiday_surcharge_rate: number;     // e.g. 100.0 (%)
}

export interface CalculatedSurcharges {
  workedHours: number;
  nightHours: number;
  sundayHours: number;
  holidayHours: number;
  nightSurcharge: number;    // Currency or relative factor calculation (we store hours and rates, and calculate value)
  sundaySurcharge: number;
  holidaySurcharge: number;
  totalSurchargePercent: number; // Combined or maximum depending on company rules (usually they accumulate or max, let's calculate them individually)
}

/**
 * Calculates the overlap between two Date intervals in hours.
 */
function getIntervalOverlapHours(start1: Date, end1: Date, start2: Date, end2: Date): number {
  const maxStart = start1 > start2 ? start1 : start2;
  const minEnd = end1 < end2 ? end1 : end2;
  
  if (maxStart < minEnd) {
    const diffMs = minEnd.getTime() - maxStart.getTime();
    return diffMs / (1000 * 60 * 60);
  }
  return 0;
}

/**
 * Helper to parse a time string "HH:MM:SS" or "HH:MM" into a Date object on a specific day.
 */
export function parseTimeToDate(dateStr: string, timeStr: string): Date {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  const d = new Date(dateStr);
  d.setHours(hours || 0, minutes || 0, seconds || 0, 0);
  return d;
}

/**
 * Main function to calculate all surcharges for a single time entry.
 */
export function calculateSurcharges(
  entryDateStr: string, // "YYYY-MM-DD"
  startTimeStr: string, // "HH:MM:SS" or "HH:MM"
  endTimeStr: string | null,   // "HH:MM:SS" or "HH:MM"
  breakMinutes: number,
  settings: SurchargeSettings
): CalculatedSurcharges {
  if (!endTimeStr) {
    return {
      workedHours: 0,
      nightHours: 0,
      sundayHours: 0,
      holidayHours: 0,
      nightSurcharge: 0,
      sundaySurcharge: 0,
      holidaySurcharge: 0,
      totalSurchargePercent: 0,
    };
  }

  // Create start and end Dates
  const startDate = parseTimeToDate(entryDateStr, startTimeStr);
  const endDate = parseTimeToDate(entryDateStr, endTimeStr);

  // If end time is before start time, it means the shift ended the next day
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const rawDurationHours = totalDurationMs / (1000 * 60 * 60);
  const breakHours = breakMinutes / 60;
  const workedHours = Math.max(0, rawDurationHours - breakHours);

  if (workedHours <= 0) {
    return {
      workedHours: 0,
      nightHours: 0,
      sundayHours: 0,
      holidayHours: 0,
      nightSurcharge: 0,
      sundaySurcharge: 0,
      holidaySurcharge: 0,
      totalSurchargePercent: 0,
    };
  }

  // Break ratio to reduce surcharge hours proportionally (fair distribution of break)
  const breakRatio = rawDurationHours > 0 ? workedHours / rawDurationHours : 0;

  // Let's define the days involved in this shift
  const day1Str = entryDateStr;
  const day2Date = new Date(startDate);
  day2Date.setDate(day2Date.getDate() + 1);
  const day2Str = day2Date.toISOString().split('T')[0];

  // 1. NIGHT HOURS CALCULATION
  // Night definition: night_surcharge_start_time (e.g. 22:00) on Day D until 06:00 on Day D+1.
  // And also 00:00 to 06:00 on Day D.
  
  // Night windows to check:
  // Window A: Day 1 from 00:00 to 06:00
  const nightAStart = parseTimeToDate(day1Str, "00:00:00");
  const nightAEnd = parseTimeToDate(day1Str, "06:00:00");
  
  // Window B: Day 1 from night_surcharge_start_time to Day 2 06:00
  const nightBStart = parseTimeToDate(day1Str, settings.night_surcharge_start_time);
  const nightBEnd = parseTimeToDate(day2Str, "06:00:00");
  
  // Window C: Day 2 from night_surcharge_start_time to Day 3 06:00
  const day3Date = new Date(day2Date);
  day3Date.setDate(day3Date.getDate() + 1);
  const day3Str = day3Date.toISOString().split('T')[0];
  const nightCStart = parseTimeToDate(day2Str, settings.night_surcharge_start_time);
  const nightCEnd = parseTimeToDate(day3Str, "06:00:00");

  const rawNightHours = 
    getIntervalOverlapHours(startDate, endDate, nightAStart, nightAEnd) +
    getIntervalOverlapHours(startDate, endDate, nightBStart, nightBEnd) +
    getIntervalOverlapHours(startDate, endDate, nightCStart, nightCEnd);
  
  // Apply break ratio
  const nightHours = Number((rawNightHours * breakRatio).toFixed(2));

  // 2. SUNDAY HOURS CALCULATION
  // Sunday is defined as Day D 00:00 to 24:00 if Day D is a Sunday.
  let rawSundayHours = 0;
  
  // Check Day 1
  if (startDate.getDay() === 0) { // 0 is Sunday
    const sunStart = parseTimeToDate(day1Str, "00:00:00");
    const sunEnd = parseTimeToDate(day2Str, "00:00:00");
    rawSundayHours += getIntervalOverlapHours(startDate, endDate, sunStart, sunEnd);
  }
  // Check Day 2
  if (endDate.getDay() === 0) {
    const sunStart = parseTimeToDate(day2Str, "00:00:00");
    const sunEnd = parseTimeToDate(day3Str, "00:00:00");
    rawSundayHours += getIntervalOverlapHours(startDate, endDate, sunStart, sunEnd);
  }

  const sundayHours = Number((rawSundayHours * breakRatio).toFixed(2));

  // 3. HOLIDAY HOURS CALCULATION
  let rawHolidayHours = 0;
  
  // Check Day 1
  if (isGermanHoliday(startDate).isHoliday) {
    const holStart = parseTimeToDate(day1Str, "00:00:00");
    const holEnd = parseTimeToDate(day2Str, "00:00:00");
    rawHolidayHours += getIntervalOverlapHours(startDate, endDate, holStart, holEnd);
  }
  // Check Day 2
  if (isGermanHoliday(endDate).isHoliday) {
    const holStart = parseTimeToDate(day2Str, "00:00:00");
    const holEnd = parseTimeToDate(day3Str, "00:00:00");
    rawHolidayHours += getIntervalOverlapHours(startDate, endDate, holStart, holEnd);
  }

  const holidayHours = Number((rawHolidayHours * breakRatio).toFixed(2));

  // Surcharges in equivalent hours = hours * (rate / 100)
  const nightSurcharge = Number((nightHours * (settings.night_surcharge_rate / 100)).toFixed(2));
  const sundaySurcharge = Number((sundayHours * (settings.sunday_surcharge_rate / 100)).toFixed(2));
  const holidaySurcharge = Number((holidayHours * (settings.holiday_surcharge_rate / 100)).toFixed(2));

  // Surcharge percentage summation
  const totalSurchargePercent = settings.night_surcharge_rate + settings.sunday_surcharge_rate + settings.holiday_surcharge_rate;

  return {
    workedHours: Number(workedHours.toFixed(2)),
    nightHours,
    sundayHours,
    holidayHours,
    nightSurcharge,
    sundaySurcharge,
    holidaySurcharge,
    totalSurchargePercent,
  };
}
