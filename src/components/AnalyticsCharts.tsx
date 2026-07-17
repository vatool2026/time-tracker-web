"use client";

import React, { useState, useMemo } from 'react';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { calculateComplianceViolations } from '@/utils/complianceCalculator';
import { BarChart2, PieChart as PieChartIcon, CalendarDays, Clock, TrendingUp, TrendingDown, Calendar as CalendarIcon, Activity, Sunrise, Moon, Sun, Sunset, Trophy, Coffee, ShieldAlert, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import YearlyOverviewTable from './YearlyOverviewTable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface TimeEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  absence_code: string | null;
  deleted_at?: string | null;
}

interface TimesheetSettings {
  target_hours_monday: number;
  target_hours_tuesday: number;
  target_hours_wednesday: number;
  target_hours_thursday: number;
  target_hours_friday: number;
  target_hours_saturday: number;
  target_hours_sunday: number;
}

interface SurchargeSettings {
  night_surcharge_start_time: string;
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
}

interface AbsenceCode {
  id: string;
  code: string;
  name: string;
  factor: number;
}

interface AnalyticsChartsProps {
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
  absenceCodes?: AbsenceCode[] | null;
  startDate?: string | null;
  profile?: any;
  companyHolidays?: any[] | null;
}

export default function AnalyticsCharts({
  entries: allEntries,
  timesheetSettings,
  surchargeSettings,
  absenceCodes,
  startDate,
  profile,
  companyHolidays
}: AnalyticsChartsProps) {
  const entries = useMemo(() => allEntries.filter(e => !e.deleted_at), [allEntries]);
  const [viewMode, setViewMode] = useState<'charts' | 'yearly'>('charts');
  const [timeframe, setTimeframe] = useState<string>('current_month');

  const tsSet = timesheetSettings || {
    target_hours_monday: 8,
    target_hours_tuesday: 8,
    target_hours_wednesday: 8,
    target_hours_thursday: 8,
    target_hours_friday: 8,
    target_hours_saturday: 0,
    target_hours_sunday: 0
  };

  const surchSet = surchargeSettings || {
    night_surcharge_start_time: '22:00:00',
    night_surcharge_end_time: '06:00:00',
    night_surcharge_rate: 25,
    sunday_surcharge_rate: 50,
    holiday_surcharge_rate: 100
  };

  const getTargetHoursForDate = (date: Date): number => {
    const dStr = date.toISOString().split('T')[0];
    if (startDate && new Date(dStr) < new Date(startDate)) return 0;

    const holidayInfo = isGermanHoliday(date, profile?.companies?.state, companyHolidays || undefined);
    if (holidayInfo.isHoliday && !holidayInfo.isHalfHoliday) return 0;

    let regularTarget = 0;
    const day = date.getDay();
    switch (day) {
      case 1: regularTarget = tsSet.target_hours_monday; break;
      case 2: regularTarget = tsSet.target_hours_tuesday; break;
      case 3: regularTarget = tsSet.target_hours_wednesday; break;
      case 4: regularTarget = tsSet.target_hours_thursday; break;
      case 5: regularTarget = tsSet.target_hours_friday; break;
      case 6: regularTarget = tsSet.target_hours_saturday; break;
      case 0: regularTarget = tsSet.target_hours_sunday; break;
    }

    if (holidayInfo.isHoliday && holidayInfo.isHalfHoliday) {
      return regularTarget / 2;
    }
    return regularTarget;
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const getDateRange = () => {
    let start, end;
    switch (timeframe) {
      case 'last_month':
        start = new Date(currentYear, currentMonth - 1, 1);
        end = new Date(currentYear, currentMonth, 0);
        break;
      case 'current_year':
        start = new Date(currentYear, 0, 1);
        end = new Date(currentYear, 11, 31);
        break;
      case 'last_year':
        start = new Date(currentYear - 1, 0, 1);
        end = new Date(currentYear - 1, 11, 31);
        break;
      case 'q1':
        start = new Date(currentYear, 0, 1);
        end = new Date(currentYear, 2, 31);
        break;
      case 'q2':
        start = new Date(currentYear, 3, 1);
        end = new Date(currentYear, 5, 30);
        break;
      case 'q3':
        start = new Date(currentYear, 6, 1);
        end = new Date(currentYear, 8, 30);
        break;
      case 'q4':
        start = new Date(currentYear, 9, 1);
        end = new Date(currentYear, 11, 31);
        break;
      case 'all_time':
        start = new Date(2000, 0, 1);
        end = new Date(2100, 0, 1);
        break;
      case 'current_month':
      default:
        start = new Date(currentYear, currentMonth, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;
    }
    return { start, end };
  };

  const { start: periodStartRaw, end: periodEndRaw } = getDateRange();
  
  let periodStart = periodStartRaw;
  let periodEnd = periodEndRaw;

  if (timeframe === 'all_time') {
     const sortedEntries = [...entries].sort((a,b) => a.entry_date.localeCompare(b.entry_date));
     if (sortedEntries.length > 0) {
        periodStart = new Date(sortedEntries[0].entry_date);
        periodEnd = now > new Date(sortedEntries[sortedEntries.length-1].entry_date) ? now : new Date(sortedEntries[sortedEntries.length-1].entry_date);
     } else {
        periodStart = new Date(currentYear, 0, 1);
        periodEnd = now;
     }
  }

  // Filter entries within period
  const periodEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d >= periodStart && d <= periodEnd;
  });

  const durationDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
  const groupByMonth = durationDays > 100; // if more than ~3 months, group by month

  let totalTargetHours = 0;
  let totalWorkedHours = 0;
  let vacationDays = 0;
  let sickDays = 0;

  const chartData = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (groupByMonth) {
    // Group by month
    const iterDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
    const endMonthDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    while (iterDate <= endMonthDate) {
      const y = iterDate.getFullYear();
      const m = iterDate.getMonth();
      const label = `${iterDate.toLocaleString('de-DE', { month: 'short' })} ${y}`;
      
      let monthTarget = 0;
      let monthActual = 0;

      // Calculate for all days in this month
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(y, m, d);
        if (dayDate > periodEnd || dayDate < periodStart) continue;

        const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const isPastOrToday = dayDate <= today;
        const dayEntries = entries.filter(e => e.entry_date === dateStr);

        if (!isPastOrToday && dayEntries.length === 0) continue;

        let target = getTargetHoursForDate(dayDate);
        let actual = 0;

        if (dayEntries.length > 0) {
          const entry = dayEntries[0];
          let isDummy = false;
          if (entry.absence_code) {
            const codeObj = absenceCodes?.find(c => c.code === entry.absence_code);
            if (codeObj) {
              target = target * codeObj.factor;
              if (codeObj.code === 'U') vacationDays++;
              if (codeObj.code === 'K' || codeObj.code === 'KR') sickDays++;
            }
            if (entry.start_time === '00:00:00' && entry.end_time === '00:00:00' && entry.break_minutes === 0) {
              isDummy = true;
            }
          }
          
          dayEntries.forEach(e => {
            if (!isDummy && e.end_time) {
              const surch = calculateSurcharges(
                e.entry_date,
                e.start_time,
                e.end_time,
                e.break_minutes || 0,
                surchSet
              );
              actual += surch.workedHoursDay1;
            }
          });
        }

        // Add hours from previous day's shift if it spanned midnight
        const prevDate = new Date(dayDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const y2 = prevDate.getFullYear();
        const m2 = prevDate.getMonth();
        const d2 = prevDate.getDate();
        const yesterdayStr = `${y2}-${(m2 + 1).toString().padStart(2, '0')}-${d2.toString().padStart(2, '0')}`;
        const yesterdayEntries = entries.filter(e => e.entry_date === yesterdayStr);
        
        yesterdayEntries.forEach(e => {
            if (e.end_time) {
              const surch = calculateSurcharges(
                e.entry_date,
                e.start_time,
                e.end_time,
                e.break_minutes || 0,
                surchSet
              );
              actual += surch.workedHoursDay2;
            }
        });

        monthTarget += target;
        monthActual += actual;
        totalTargetHours += target;
        totalWorkedHours += actual;
      }

      chartData.push({
        date: label,
        fullDate: label,
        target: parseFloat(monthTarget.toFixed(1)),
        actual: parseFloat(monthActual.toFixed(1))
      });

      iterDate.setMonth(iterDate.getMonth() + 1);
    }
  } else {
    // Group by day
    const iterDate = new Date(periodStart);
    while (iterDate <= periodEnd) {
      const dStr = iterDate.getDate().toString().padStart(2, '0');
      const mStr = (iterDate.getMonth() + 1).toString().padStart(2, '0');
      const yStr = iterDate.getFullYear();
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      const dayNum = iterDate.getDate();
      
      const isPastOrToday = iterDate <= today;
      const dayEntries = entries.filter(e => e.entry_date === dateStr);

      if (!isPastOrToday && dayEntries.length === 0) {
        iterDate.setDate(iterDate.getDate() + 1);
        continue;
      }

      let target = getTargetHoursForDate(iterDate);
      let actual = 0;

      if (dayEntries.length > 0) {
        const entry = dayEntries[0];
        let isDummy = false;
        if (entry.absence_code) {
          const codeObj = absenceCodes?.find(c => c.code === entry.absence_code);
          if (codeObj) {
            target = target * codeObj.factor;
            if (codeObj.code === 'U') vacationDays++;
            if (codeObj.code === 'K' || codeObj.code === 'KR') sickDays++;
          }
          if (entry.start_time === '00:00:00' && entry.end_time === '00:00:00' && entry.break_minutes === 0) {
            isDummy = true;
          }
        }
        
        dayEntries.forEach(e => {
          if (!isDummy && e.end_time) {
            const surch = calculateSurcharges(
              e.entry_date,
              e.start_time,
              e.end_time,
              e.break_minutes || 0,
              surchSet
            );
            actual += surch.workedHoursDay1;
          }
        });
      }

      // Add hours from previous day's shift if it spanned midnight
      const prevDate = new Date(iterDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const y2 = prevDate.getFullYear();
      const m2 = prevDate.getMonth();
      const d2 = prevDate.getDate();
      const yesterdayStr = `${y2}-${(m2 + 1).toString().padStart(2, '0')}-${d2.toString().padStart(2, '0')}`;
      const yesterdayEntries = entries.filter(e => e.entry_date === yesterdayStr);
      
      yesterdayEntries.forEach(e => {
          if (e.end_time) {
            const surch = calculateSurcharges(
              e.entry_date,
              e.start_time,
              e.end_time,
              e.break_minutes || 0,
              surchSet
            );
            actual += surch.workedHoursDay2;
          }
      });

      totalTargetHours += target;
      totalWorkedHours += actual;

      chartData.push({
        date: `${dayNum}.`,
        fullDate: dateStr,
        target: parseFloat(target.toFixed(1)),
        actual: parseFloat(actual.toFixed(1))
      });

      iterDate.setDate(iterDate.getDate() + 1);
    }
  }

  const overtime = totalWorkedHours - totalTargetHours;
  const isOvertimePositive = overtime >= 0;

  // FUN FACTS CALCULATIONS
  let maxWorkedHours = 0;
  let maxWorkedDayStr = '';
  let totalBreakMinutes = 0;
  let totalStartTimeMinutes = 0;
  let startTimeCount = 0;
  let totalEndTimeMinutes = 0;
  let endTimeCount = 0;
  
  const weekdayHours = {
    'Mo': { total: 0, count: 0 },
    'Di': { total: 0, count: 0 },
    'Mi': { total: 0, count: 0 },
    'Do': { total: 0, count: 0 },
    'Fr': { total: 0, count: 0 },
    'Sa': { total: 0, count: 0 },
    'So': { total: 0, count: 0 },
  };

  const getDayName = (d: number) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d];

  const entriesByDate: Record<string, TimeEntry[]> = {};
  periodEntries.forEach(e => {
    if (!entriesByDate[e.entry_date]) entriesByDate[e.entry_date] = [];
    entriesByDate[e.entry_date].push(e);
  });

  Object.entries(entriesByDate).forEach(([dateStr, dayEntries]) => {
    let dayWorkedHours = 0;
    let hasAbsence = false;
    let earliestStart = '23:59:00';
    let latestEnd = '00:00:00';
    
    dayEntries.forEach(entry => {
      if (entry.absence_code) hasAbsence = true;
      if (entry.break_minutes) totalBreakMinutes += entry.break_minutes;

      if (entry.start_time && entry.start_time < earliestStart) earliestStart = entry.start_time;
      if (entry.end_time && entry.end_time > latestEnd) latestEnd = entry.end_time;

      if (!entry.absence_code && entry.end_time) {
        const surch = calculateSurcharges(
          entry.entry_date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0,
          surchSet
        );
        dayWorkedHours += surch.workedHours;
      }
    });

    if (earliestStart !== '23:59:00') {
      const [h, m] = earliestStart.split(':').map(Number);
      totalStartTimeMinutes += h * 60 + m;
      startTimeCount++;
    }
    
    if (latestEnd !== '00:00:00') {
      const [h, m] = latestEnd.split(':').map(Number);
      totalEndTimeMinutes += h * 60 + m;
      endTimeCount++;
    }

    if (!hasAbsence && dayWorkedHours > 0) {
      const dayName = getDayName(new Date(dateStr).getDay());
      if (weekdayHours[dayName as keyof typeof weekdayHours]) {
        weekdayHours[dayName as keyof typeof weekdayHours].total += dayWorkedHours;
        weekdayHours[dayName as keyof typeof weekdayHours].count++;
      }

      if (dayWorkedHours > maxWorkedHours) {
        maxWorkedHours = dayWorkedHours;
        maxWorkedDayStr = new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
      }
    }
  });

  const formatTime = (totalMins: number, count: number) => {
    if (count === 0) return '--:--';
    const avgMins = Math.round(totalMins / count);
    const h = Math.floor(avgMins / 60).toString().padStart(2, '0');
    const m = (avgMins % 60).toString().padStart(2, '0');
    return `${h}:${m} Uhr`;
  };

  const avgStart = formatTime(totalStartTimeMinutes, startTimeCount);
  const avgEnd = formatTime(totalEndTimeMinutes, endTimeCount);
  const totalBreakHours = (totalBreakMinutes / 60).toFixed(1);

  const radarData = [
    { name: 'Mo', stunden: weekdayHours['Mo'].count ? weekdayHours['Mo'].total / weekdayHours['Mo'].count : 0 },
    { name: 'Di', stunden: weekdayHours['Di'].count ? weekdayHours['Di'].total / weekdayHours['Di'].count : 0 },
    { name: 'Mi', stunden: weekdayHours['Mi'].count ? weekdayHours['Mi'].total / weekdayHours['Mi'].count : 0 },
    { name: 'Do', stunden: weekdayHours['Do'].count ? weekdayHours['Do'].total / weekdayHours['Do'].count : 0 },
    { name: 'Fr', stunden: weekdayHours['Fr'].count ? weekdayHours['Fr'].total / weekdayHours['Fr'].count : 0 },
    { name: 'Sa', stunden: weekdayHours['Sa'].count ? weekdayHours['Sa'].total / weekdayHours['Sa'].count : 0 },
    { name: 'So', stunden: weekdayHours['So'].count ? weekdayHours['So'].total / weekdayHours['So'].count : 0 },
  ];

  let bestDay = 'Mo';
  let bestDayAvg = 0;
  radarData.forEach(d => {
    if (d.stunden > bestDayAvg) {
      bestDayAvg = d.stunden;
      bestDay = d.name;
    }
  });

  const getDayFullName = (short: string) => {
    const map: Record<string, string> = { 'Mo': 'Montag', 'Di': 'Dienstag', 'Mi': 'Mittwoch', 'Do': 'Donnerstag', 'Fr': 'Freitag', 'Sa': 'Samstag', 'So': 'Sonntag' };
    return map[short] || short;
  };

  const avgStartMin = startTimeCount > 0 ? (totalStartTimeMinutes / startTimeCount) : 0;
  const isEarlyBird = startTimeCount > 0 && avgStartMin < 8 * 60;
  const isNightOwl = startTimeCount > 0 && avgStartMin > 9 * 60 + 30;

  // COMPLIANCE CALCULATION for the selected period
  const mockSettings = surchargeSettings ? { ...surchargeSettings, category: profile?.employment_category } : null;
  const complianceResults = calculateComplianceViolations(
    profile ? [profile] : [], 
    entries, 
    mockSettings ? [mockSettings] : []
  );

  let periodViolations = 0;
  if (complianceResults.length > 0) {
    const allV = complianceResults[0].violations;
    const errorsInPeriod = allV.filter(v => {
      if (v.severity !== 'error') return false;
      const d = new Date(v.date);
      return d >= periodStart && d <= periodEnd;
    });
    periodViolations = errorsInPeriod.length;
  }

  const getTimeframeLabel = () => {
    const options: Record<string, string> = {
      'current_month': 'Aktueller Monat',
      'last_month': 'Letzter Monat',
      'current_year': 'Aktuelles Jahr',
      'last_year': 'Letztes Jahr',
      'q1': '1. Quartal',
      'q2': '2. Quartal',
      'q3': '3. Quartal',
      'q4': '4. Quartal',
      'all_time': 'Komplett'
    };
    return options[timeframe] || 'Ausgewählter Zeitraum';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className={`btn ${viewMode === 'charts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('charts')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PieChartIcon size={16} />
            Übersicht
          </button>
          <button
            className={`btn ${viewMode === 'yearly' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('yearly')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <CalendarDays size={16} />
            Jahresübersicht
          </button>
        </div>

        {viewMode === 'charts' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Zeitraum:</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="input-field"
              style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', minWidth: '160px', cursor: 'pointer' }}
            >
              <option value="current_month">Aktueller Monat</option>
              <option value="last_month">Letzter Monat</option>
              <option value="q1">1. Quartal</option>
              <option value="q2">2. Quartal</option>
              <option value="q3">3. Quartal</option>
              <option value="q4">4. Quartal</option>
              <option value="current_year">Aktuelles Jahr</option>
              <option value="last_year">Letztes Jahr</option>
              <option value="all_time">Komplett</option>
            </select>
          </div>
        )}
      </div>

      {viewMode === 'charts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            
            {/* Hours Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <Clock size={16} />
                Arbeitszeit ({getTimeframeLabel()})
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {totalWorkedHours.toFixed(1)} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ {totalTargetHours.toFixed(1)} h</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Ist-Stunden vs. Soll-Stunden
              </div>
            </div>

            {/* Overtime Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <Activity size={16} />
                Überstunden ({getTimeframeLabel()})
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: isOvertimePositive ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isOvertimePositive ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                {isOvertimePositive ? '+' : ''}{overtime.toFixed(1)} h
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {isOvertimePositive ? 'Du hast Mehrarbeit geleistet.' : 'Du hast Minusstunden aufgebaut.'}
              </div>
            </div>

            {/* Absences Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <CalendarIcon size={16} />
                Abwesenheiten
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{vacationDays}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Urlaubstage</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--glass-border)' }}></div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{sickDays}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Krankheitstage</div>
                </div>
              </div>
            </div>

            {/* Compliance Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: `4px solid ${periodViolations > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <ShieldAlert size={16} />
                Arbeitszeitschutz ({getTimeframeLabel()})
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: periodViolations > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {periodViolations} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Verstöße</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {periodViolations === 0 ? 'Alles im grünen Bereich.' : 'Achte auf deine Arbeits- und Pausenzeiten.'}
              </div>
            </div>

          </div>

          {/* Bar Chart */}
          <div className="glass glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <BarChart2 size={18} className="text-gradient" /> Arbeitszeit-Verlauf ({getTimeframeLabel()})
            </h3>

            <div style={{ width: '100%', height: '300px', marginTop: 'auto' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={5} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}h`} />
                  <Tooltip 
                    cursor={{ fill: 'var(--glass-border)', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                    labelFormatter={(label, payload) => payload && payload.length > 0 ? payload[0].payload.fullDate : label}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary)" />
                      <stop offset="100%" stopColor="var(--accent-secondary)" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="actual" name="Ist-Stunden" fill="url(#colorActual)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  <Line type="step" dataKey="target" name="Soll-Stunden" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fun Facts Section */}
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>✨ Fun Facts ({getTimeframeLabel()})</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              
              {/* Radar Chart Card */}
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', gridRow: 'span 2' }}>
                <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <TrendingUp size={18} className="text-gradient" /> Dein produktivster Tag
                </h4>
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="var(--glass-border)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                      <Radar name="Ø Stunden" dataKey="stunden" stroke="var(--accent-primary)" fill="url(#colorActual)" fillOpacity={0.5} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }} formatter={(val: any) => [`${Number(val).toFixed(1)}h`, 'Schnitt']} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                  Du scheinst ein richtiger <strong>{getDayFullName(bestDay)}s-Held</strong> zu sein! An diesem Tag arbeitest du im Schnitt am meisten ({bestDayAvg.toFixed(1)}h).
                </p>
              </div>

              {/* Start Time Card */}
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isEarlyBird ? 'var(--warning)' : (isNightOwl ? 'var(--accent-secondary)' : 'var(--info)'), fontWeight: 600 }}>
                  {isEarlyBird ? <Sunrise size={20} /> : (isNightOwl ? <Moon size={20} /> : <Sun size={20} />)}
                  {isEarlyBird ? 'Frühaufsteher' : (isNightOwl ? 'Nachteule' : 'Ausgeglichen')}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Ø {avgStart}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {isEarlyBird ? 'Der frühe Vogel fängt den Wurm! Im Durchschnitt startest du sehr zeitig in den Tag.' : (isNightOwl ? 'Du lässt dir morgens Zeit und startest im Schnitt eher entspannt.' : 'Im Durchschnitt startest du zur typischen Bürozeit in den Tag.')}
                </div>
              </div>

              {/* End Time Card */}
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  <Sunset size={20} /> Feierabend-Trend
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Ø {avgEnd}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Dein wohlverdienter Feierabend beginnt im Durchschnitt um diese Uhrzeit.
                </div>
              </div>

              {/* Marathon Card */}
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
                  <Trophy size={20} /> Marathon-Tag
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{maxWorkedHours.toFixed(1)} h</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Dein Rekord: Am {maxWorkedDayStr || 'bisher noch keinem Tag'} hast du ordentlich durchgezogen!
                </div>
              </div>

              {/* Break King Card */}
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 600 }}>
                  <Coffee size={20} /> Pausen-König
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalBreakHours} h</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  So viel Zeit hast du in diesem Zeitraum bereits in der Pause verbracht. Erholung ist wichtig!
                </div>
              </div>

            </div>
          </div>

        </div>
      ) : (
        <YearlyOverviewTable 
          entries={entries}
          timesheetSettings={tsSet}
          surchargeSettings={surchSet}
          absenceCodes={absenceCodes || []}
          startDate={startDate}
          companyState={profile?.companies?.state}
          companyHolidays={companyHolidays || undefined}
        />
      )}
    </div>
  );
}
