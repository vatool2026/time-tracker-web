"use client";

import React, { useState } from 'react';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { calculateComplianceViolations } from '@/utils/complianceCalculator';
import { BarChart2, PieChart as PieChartIcon, CalendarDays, Clock, TrendingUp, TrendingDown, Calendar as CalendarIcon, Activity, Sunrise, Moon, Sun, Sunset, Trophy, Coffee, ShieldAlert } from 'lucide-react';
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
}

export default function AnalyticsCharts({
  entries,
  timesheetSettings,
  surchargeSettings,
  absenceCodes,
  startDate,
  profile
}: AnalyticsChartsProps) {
  const [viewMode, setViewMode] = useState<'charts' | 'yearly'>('charts');

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

    if (isGermanHoliday(date).isHoliday) return 0;
    const day = date.getDay();
    switch (day) {
      case 1: return tsSet.target_hours_monday;
      case 2: return tsSet.target_hours_tuesday;
      case 3: return tsSet.target_hours_wednesday;
      case 4: return tsSet.target_hours_thursday;
      case 5: return tsSet.target_hours_friday;
      case 6: return tsSet.target_hours_saturday;
      case 0: return tsSet.target_hours_sunday;
      default: return 0;
    }
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const daysInMonth: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    daysInMonth.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }

  let totalTargetHours = 0;
  let totalWorkedHours = 0;
  let vacationDays = 0;
  let sickDays = 0;

  const dailyData = daysInMonth.map(day => {
    const dStr = day.getDate().toString().padStart(2, '0');
    const mStr = (day.getMonth() + 1).toString().padStart(2, '0');
    const yStr = day.getFullYear();
    const dateStr = `${yStr}-${mStr}-${dStr}`;
    const dayNum = day.getDate();
    
    const isPastOrToday = day <= now;
    
    let target = getTargetHoursForDate(day);
    let actual = 0;

    const entry = entries.find(e => e.entry_date === dateStr);
    if (entry) {
      if (entry.absence_code === 'U') {
        vacationDays++;
        actual = target;
      } else if (entry.absence_code === 'K') {
        sickDays++;
        actual = target;
      } else if (!entry.absence_code && entry.end_time) {
        const surch = calculateSurcharges(
          entry.entry_date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0,
          surchSet
        );
        actual = surch.workedHours;
      }
    }

    if (isPastOrToday) {
      totalTargetHours += target;
      totalWorkedHours += actual;
    }

    return {
      date: `${dayNum}.`,
      fullDate: dateStr,
      target,
      actual
    };
  });

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

  const currentMonthEntries = entries.filter(e => {
    const d = new Date(e.entry_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  currentMonthEntries.forEach(entry => {
    if (entry.break_minutes) totalBreakMinutes += entry.break_minutes;

    if (entry.start_time) {
      const [h, m] = entry.start_time.split(':').map(Number);
      totalStartTimeMinutes += h * 60 + m;
      startTimeCount++;
    }
    if (entry.end_time) {
      const [h, m] = entry.end_time.split(':').map(Number);
      totalEndTimeMinutes += h * 60 + m;
      endTimeCount++;
    }

    if (!entry.absence_code && entry.end_time) {
      const surch = calculateSurcharges(
        entry.entry_date,
        entry.start_time,
        entry.end_time,
        entry.break_minutes || 0,
        surchSet
      );
      
      const dayName = getDayName(new Date(entry.entry_date).getDay());
      if (weekdayHours[dayName as keyof typeof weekdayHours]) {
        weekdayHours[dayName as keyof typeof weekdayHours].total += surch.workedHours;
        weekdayHours[dayName as keyof typeof weekdayHours].count++;
      }

      if (surch.workedHours > maxWorkedHours) {
        maxWorkedHours = surch.workedHours;
        maxWorkedDayStr = new Date(entry.entry_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });
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

  // COMPLIANCE CALCULATION
  const mockSettings = surchargeSettings ? { ...surchargeSettings, category: profile?.employment_category } : null;
  const complianceResults = calculateComplianceViolations(
    profile ? [profile] : [], 
    entries, 
    mockSettings ? [mockSettings] : []
  );

  let currentMonthViolations = 0;
  if (complianceResults.length > 0) {
    const allV = complianceResults[0].violations;
    const monthErrors = allV.filter(v => {
      if (v.severity !== 'error') return false;
      const d = new Date(v.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    currentMonthViolations = monthErrors.length;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <button
          className={`btn ${viewMode === 'charts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode('charts')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <PieChartIcon size={16} />
          Übersicht (Monat)
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

      {viewMode === 'charts' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            
            {/* Hours Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <Clock size={16} />
                Aktueller Monat
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {totalWorkedHours.toFixed(1)} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ {totalTargetHours.toFixed(1)} h</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Ist-Stunden vs. Soll-Stunden (bis heute)
              </div>
            </div>

            {/* Overtime Card */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <Activity size={16} />
                Überstunden (Monat)
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
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: `4px solid ${currentMonthViolations > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                <ShieldAlert size={16} />
                Arbeitszeitschutz (Monat)
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: currentMonthViolations > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {currentMonthViolations} <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Verstöße</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {currentMonthViolations === 0 ? 'Alles im grünen Bereich.' : 'Achte auf deine Arbeits- und Pausenzeiten.'}
              </div>
            </div>

          </div>

          {/* Daily Bar Chart */}
          <div className="glass glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <BarChart2 size={18} className="text-gradient" /> Tägliche Arbeitszeit (Aktueller Monat)
            </h3>

            <div style={{ width: '100%', height: '300px', marginTop: 'auto' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={5} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}h`} />
                  <Tooltip 
                    cursor={{ fill: 'var(--glass-border)', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                    labelFormatter={(label) => `Tag: ${label}`}
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
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>✨ Fun Facts (Diesen Monat)</h3>
            
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
                  So viel Zeit hast du in diesem Monat bereits in der Pause verbracht. Erholung ist wichtig!
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
        />
      )}
    </div>
  );
}
