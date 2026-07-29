import { isGermanHoliday } from './holidays';

export interface SurchargeSettings {
  night_surcharge_start_time: string; // e.g. "22:00:00"
  night_surcharge_end_time: string;   // e.g. "06:00:00"
  night_surcharge_rate: number;       // e.g. 25.0 (%)
  sunday_surcharge_rate: number;      // e.g. 50.0 (%)
  holiday_surcharge_rate: number;     // e.g. 100.0 (%)
  auto_break_deduction_enabled?: boolean;
}

export interface SurchargeInterval {
  text: string;
  hours: number;
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
  nightIntervals?: SurchargeInterval[];
  sundayIntervals?: SurchargeInterval[];
  holidayIntervals?: SurchargeInterval[];
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

function getOverlapInterval(start1: Date, end1: Date, start2: Date, end2: Date): {start: Date, end: Date} | null {
  const maxStart = start1 > start2 ? start1 : start2;
  const minEnd = end1 < end2 ? end1 : end2;
  
  if (maxStart < minEnd) {
    return { start: maxStart, end: minEnd };
  }
  return null;
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

  const exactBreakIntervals: { start: Date, end: Date }[] = [];
  if (hasExactLogs && breakLogs) {
    for (const log of breakLogs) {
      if (log.start && log.end) {
        const bStart = new Date(log.start);
        const bEnd = new Date(log.end);
        if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
          exactBreakIntervals.push({ start: bStart, end: bEnd });
        }
      }
    }
  }

  const nightIntervals: SurchargeInterval[] = [];
  const sundayIntervals: SurchargeInterval[] = [];
  const holidayIntervals: SurchargeInterval[] = [];

  const addOverlap = (s1: Date, e1: Date, s2: Date, e2: Date, arr: SurchargeInterval[]) => {
    const o = getOverlapInterval(s1, e1, s2, e2);
    const overlapH = getIntervalOverlapHours(s1, e1, s2, e2);
    
    let effectiveH = overlapH;
    
    if (o && overlapH > 0) {
      if (hasExactLogs) {
        let exactBreakDeduction = 0;
        for (const b of exactBreakIntervals) {
          exactBreakDeduction += getIntervalOverlapHours(o.start, o.end, b.start, b.end);
        }
        effectiveH = Math.max(0, overlapH - exactBreakDeduction);
      } else {
        effectiveH = overlapH * breakRatio;
      }
      
      const f = (d: Date) => d.toTimeString().slice(0, 5);
      arr.push({ 
        text: `${f(o.start)} - ${f(o.end)}`, 
        rawHours: Number(overlapH.toFixed(2)), 
        effectiveHours: Number(effectiveH.toFixed(2)) 
      });
    }
    return { raw: overlapH, effective: effectiveH };
  };

  // Let's define the actual shift bounds for Day 1 and Day 2
  const d1End = new Date(Math.min(endDate.getTime(), midNight.getTime()));
  const d2Start = new Date(Math.max(startDate.getTime(), midNight.getTime()));

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
  let rawNightDay1 = 0, effNightDay1 = 0;
  const n1A = addOverlap(startDate, d1End, nightAStart, nightAEnd, nightIntervals);
  rawNightDay1 += n1A.raw; effNightDay1 += n1A.effective;
  const n1B = addOverlap(startDate, d1End, nightBStart, nightBEnd, nightIntervals);
  rawNightDay1 += n1B.raw; effNightDay1 += n1B.effective;

  // Day 2 night overlaps:
  let rawNightDay2 = 0, effNightDay2 = 0;
  const n2A = addOverlap(d2Start, endDate, nightBStart, nightBEnd, nightIntervals);
  rawNightDay2 += n2A.raw; effNightDay2 += n2A.effective;
  const n2B = addOverlap(d2Start, endDate, nightCStart, nightCEnd, nightIntervals);
  rawNightDay2 += n2B.raw; effNightDay2 += n2B.effective;

  const nightHours = Number((effNightDay1 + effNightDay2).toFixed(2));
  const nightHoursDay1 = Number(effNightDay1.toFixed(2));
  const nightHoursDay2 = Number(effNightDay2.toFixed(2));

  // 2. SUNDAY HOURS CALCULATION
  let rawSundayDay1 = 0, effSundayDay1 = 0;
  let rawSundayDay2 = 0, effSundayDay2 = 0;
  
  if (startDate.getDay() === 0) { // 0 is Sunday
    const sunStart = parseTimeToDate(day1Str, "00:00:00");
    const sunEnd = parseTimeToDate(day2Str, "00:00:00");
    const s1 = addOverlap(startDate, d1End, sunStart, sunEnd, sundayIntervals);
    rawSundayDay1 += s1.raw; effSundayDay1 += s1.effective;
  }
  if (endDate.getDay() === 0) {
    const sunStart = parseTimeToDate(day2Str, "00:00:00");
    const sunEnd = parseTimeToDate(day3Str, "00:00:00");
    const s2 = addOverlap(d2Start, endDate, sunStart, sunEnd, sundayIntervals);
    rawSundayDay2 += s2.raw; effSundayDay2 += s2.effective;
  }

  const sundayHours = Number((effSundayDay1 + effSundayDay2).toFixed(2));
  const sundayHoursDay1 = Number(effSundayDay1.toFixed(2));
  const sundayHoursDay2 = Number(effSundayDay2.toFixed(2));

  // 3. HOLIDAY HOURS CALCULATION
  let rawHolidayDay1 = 0, effHolidayDay1 = 0;
  let rawHolidayDay2 = 0, effHolidayDay2 = 0;
  
  const holidayInfo1 = isGermanHoliday(startDate, companyState, companyHolidays);
  if (holidayInfo1.isHoliday && !holidayInfo1.isHalfHoliday) {
    const holStart = parseTimeToDate(day1Str, "00:00:00");
    const holEnd = parseTimeToDate(day2Str, "00:00:00");
    const h1 = addOverlap(startDate, d1End, holStart, holEnd, holidayIntervals);
    rawHolidayDay1 += h1.raw; effHolidayDay1 += h1.effective;
  }
  
  const holidayInfo2 = isGermanHoliday(endDate, companyState, companyHolidays);
  if (holidayInfo2.isHoliday && !holidayInfo2.isHalfHoliday) {
    const holStart = parseTimeToDate(day2Str, "00:00:00");
    const holEnd = parseTimeToDate(day3Str, "00:00:00");
    const h2 = addOverlap(d2Start, endDate, holStart, holEnd, holidayIntervals);
    rawHolidayDay2 += h2.raw; effHolidayDay2 += h2.effective;
  }

  const holidayHours = Number((effHolidayDay1 + effHolidayDay2).toFixed(2));
  const holidayHoursDay1 = Number(effHolidayDay1.toFixed(2));
  const holidayHoursDay2 = Number(effHolidayDay2.toFixed(2));

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
    nightIntervals,
    sundayIntervals,
    holidayIntervals
  };
}

