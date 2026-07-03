import { isGermanHoliday } from './holidays';

export interface SurchargeSettings {
  night_surcharge_start_time: string; // e.g. "22:00:00"
  night_surcharge_end_time: string;   // e.g. "06:00:00"
  night_surcharge_rate: number;       // e.g. 25.0 (%)
  sunday_surcharge_rate: number;      // e.g. 50.0 (%)
  holiday_surcharge_rate: number;     // e.g. 100.0 (%)
  auto_break_deduction_enabled?: boolean;
}

export interface CalculatedSurcharges {
  workedHours: number;
  workedHoursDay1: number;
  workedHoursDay2: number;
  nightHours: number;
  nightHoursDay1: number;
  nightHoursDay2: number;
  sundayHours: number;
  sundayHoursDay1: number;
  sundayHoursDay2: number;
  holidayHours: number;
  holidayHoursDay1: number;
  holidayHoursDay2: number;
  nightSurcharge: number;
  sundaySurcharge: number;
  holidaySurcharge: number;
  totalSurchargePercent: number;
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
  settings: SurchargeSettings,
  companyState?: string,
  companyHolidays?: any[],
  breakLogs?: any[]
): CalculatedSurcharges {
  const zeroSurcharges: CalculatedSurcharges = {
    workedHours: 0, workedHoursDay1: 0, workedHoursDay2: 0,
    nightHours: 0, nightHoursDay1: 0, nightHoursDay2: 0,
    sundayHours: 0, sundayHoursDay1: 0, sundayHoursDay2: 0,
    holidayHours: 0, holidayHoursDay1: 0, holidayHoursDay2: 0,
    nightSurcharge: 0, sundaySurcharge: 0, holidaySurcharge: 0,
    totalSurchargePercent: 0,
  };

  if (!endTimeStr) return zeroSurcharges;

  // Create start and end Dates
  const startDate = parseTimeToDate(entryDateStr, startTimeStr);
  const endDate = parseTimeToDate(entryDateStr, endTimeStr);

  let isSplit = false;
  // If end time is before start time, it means the shift ended the next day
  if (endDate < startDate) {
    endDate.setDate(endDate.getDate() + 1);
    isSplit = true;
  }

  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const rawDurationHours = totalDurationMs / (1000 * 60 * 60);
  
  let breakHours = breakMinutes / 60;
  
  if (settings.auto_break_deduction_enabled) {
    if (rawDurationHours > 9) {
      breakHours = Math.max(breakHours, 45 / 60);
    } else if (rawDurationHours > 6) {
      breakHours = Math.max(breakHours, 30 / 60);
    }
  }
  
  const workedHours = Math.max(0, rawDurationHours - breakHours);

  if (workedHours <= 0) return zeroSurcharges;

  // Break ratio to reduce surcharge hours proportionally (fair distribution of break)
  const breakRatio = rawDurationHours > 0 ? workedHours / rawDurationHours : 0;

  // Let's define the days involved in this shift
  const day1Str = entryDateStr;
  const day2Date = new Date(startDate);
  day2Date.setDate(day2Date.getDate() + 1);
  const day2Str = day2Date.toISOString().split('T')[0];
  
  const midNight = parseTimeToDate(day2Str, "00:00:00");

  const rawWorkedDay1 = getIntervalOverlapHours(startDate, endDate, startDate, midNight);
  const rawWorkedDay2 = getIntervalOverlapHours(startDate, endDate, midNight, endDate);

  let workedHoursDay1 = 0;
  let workedHoursDay2 = 0;

  // Calculate exact break times if logs are available and have start/end
  let hasExactLogs = false;
  let exactBreakDay1Ms = 0;
  let exactBreakDay2Ms = 0;

  if (breakLogs && breakLogs.length > 0) {
    let allLogsHaveTimes = true;
    for (const log of breakLogs) {
      if (log.start && log.end) {
        const bStart = new Date(log.start);
        const bEnd = new Date(log.end);
        if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
          exactBreakDay1Ms += getIntervalOverlapHours(bStart, bEnd, startDate, midNight) * (1000 * 60 * 60);
          exactBreakDay2Ms += getIntervalOverlapHours(bStart, bEnd, midNight, endDate) * (1000 * 60 * 60);
        } else {
          allLogsHaveTimes = false;
        }
      } else {
        allLogsHaveTimes = false;
      }
    }
    
    // If all logs have exact times, we can use exact deduction, otherwise fallback to proportional.
    // Also, if auto break deduction added more break than the logs sum, we fallback to proportional for simplicity or distribute the remainder.
    const loggedBreakMs = exactBreakDay1Ms + exactBreakDay2Ms;
    const totalBreakMs = breakHours * (1000 * 60 * 60);
    
    // If the logged break covers the entire break (within a margin of error) and all have exact times
    if (allLogsHaveTimes && loggedBreakMs >= totalBreakMs - 60000) {
      hasExactLogs = true;
      const bDay1 = exactBreakDay1Ms / (1000 * 60 * 60);
      const bDay2 = exactBreakDay2Ms / (1000 * 60 * 60);
      workedHoursDay1 = Number((rawWorkedDay1 - bDay1).toFixed(2));
      workedHoursDay2 = Number((rawWorkedDay2 - bDay2).toFixed(2));
    }
  }

  if (!hasExactLogs) {
    workedHoursDay1 = Number((rawWorkedDay1 * breakRatio).toFixed(2));
    workedHoursDay2 = Number((rawWorkedDay2 * breakRatio).toFixed(2));
  }

  // 1. NIGHT HOURS CALCULATION
  const nightAStart = parseTimeToDate(day1Str, "00:00:00");
  const nightAEnd = parseTimeToDate(day1Str, settings.night_surcharge_end_time || "06:00:00");
  const nightBStart = parseTimeToDate(day1Str, settings.night_surcharge_start_time);
  const nightBEnd = parseTimeToDate(day2Str, settings.night_surcharge_end_time || "06:00:00");
  
  const day3Date = new Date(day2Date);
  day3Date.setDate(day3Date.getDate() + 1);
  const day3Str = day3Date.toISOString().split('T')[0];
  const nightCStart = parseTimeToDate(day2Str, settings.night_surcharge_start_time);
  const nightCEnd = parseTimeToDate(day3Str, settings.night_surcharge_end_time || "06:00:00");

  // Day 1 night overlaps:
  let rawNightDay1 = 0;
  rawNightDay1 += getIntervalOverlapHours(startDate, midNight, nightAStart, nightAEnd);
  rawNightDay1 += getIntervalOverlapHours(startDate, midNight, nightBStart, nightBEnd);

  // Day 2 night overlaps:
  let rawNightDay2 = 0;
  rawNightDay2 += getIntervalOverlapHours(midNight, endDate, nightBStart, nightBEnd); // 00:00 to 06:00 on Day 2
  rawNightDay2 += getIntervalOverlapHours(midNight, endDate, nightCStart, nightCEnd);

  const rawNightHours = rawNightDay1 + rawNightDay2;
  const nightHours = Number((rawNightHours * breakRatio).toFixed(2));
  const nightHoursDay1 = Number((rawNightDay1 * breakRatio).toFixed(2));
  const nightHoursDay2 = Number((rawNightDay2 * breakRatio).toFixed(2));

  // 2. SUNDAY HOURS CALCULATION
  let rawSundayDay1 = 0;
  let rawSundayDay2 = 0;
  
  if (startDate.getDay() === 0) { // 0 is Sunday
    const sunStart = parseTimeToDate(day1Str, "00:00:00");
    const sunEnd = parseTimeToDate(day2Str, "00:00:00");
    rawSundayDay1 += getIntervalOverlapHours(startDate, midNight, sunStart, sunEnd);
  }
  if (endDate.getDay() === 0) {
    const sunStart = parseTimeToDate(day2Str, "00:00:00");
    const sunEnd = parseTimeToDate(day3Str, "00:00:00");
    rawSundayDay2 += getIntervalOverlapHours(midNight, endDate, sunStart, sunEnd);
  }

  const rawSundayHours = rawSundayDay1 + rawSundayDay2;
  const sundayHours = Number((rawSundayHours * breakRatio).toFixed(2));
  const sundayHoursDay1 = Number((rawSundayDay1 * breakRatio).toFixed(2));
  const sundayHoursDay2 = Number((rawSundayDay2 * breakRatio).toFixed(2));

  // 3. HOLIDAY HOURS CALCULATION
  let rawHolidayDay1 = 0;
  let rawHolidayDay2 = 0;
  
  if (isGermanHoliday(startDate, companyState, companyHolidays).isHoliday) {
    const holStart = parseTimeToDate(day1Str, "00:00:00");
    const holEnd = parseTimeToDate(day2Str, "00:00:00");
    rawHolidayDay1 += getIntervalOverlapHours(startDate, midNight, holStart, holEnd);
  }
  if (isGermanHoliday(endDate, companyState, companyHolidays).isHoliday) {
    const holStart = parseTimeToDate(day2Str, "00:00:00");
    const holEnd = parseTimeToDate(day3Str, "00:00:00");
    rawHolidayDay2 += getIntervalOverlapHours(midNight, endDate, holStart, holEnd);
  }

  const rawHolidayHours = rawHolidayDay1 + rawHolidayDay2;
  const holidayHours = Number((rawHolidayHours * breakRatio).toFixed(2));
  const holidayHoursDay1 = Number((rawHolidayDay1 * breakRatio).toFixed(2));
  const holidayHoursDay2 = Number((rawHolidayDay2 * breakRatio).toFixed(2));

  // Surcharges in equivalent hours = hours * (rate / 100)
  const nightSurcharge = Number((nightHours * (settings.night_surcharge_rate / 100)).toFixed(2));
  const sundaySurcharge = Number((sundayHours * (settings.sunday_surcharge_rate / 100)).toFixed(2));
  const holidaySurcharge = Number((holidayHours * (settings.holiday_surcharge_rate / 100)).toFixed(2));

  // Surcharge percentage summation
  const totalSurchargePercent = settings.night_surcharge_rate + settings.sunday_surcharge_rate + settings.holiday_surcharge_rate;

  return {
    workedHours: Number(workedHours.toFixed(2)),
    workedHoursDay1,
    workedHoursDay2,
    nightHours,
    nightHoursDay1,
    nightHoursDay2,
    sundayHours,
    sundayHoursDay1,
    sundayHoursDay2,
    holidayHours,
    holidayHoursDay1,
    holidayHoursDay2,
    nightSurcharge,
    sundaySurcharge,
    holidaySurcharge,
    totalSurchargePercent,
  };
}

