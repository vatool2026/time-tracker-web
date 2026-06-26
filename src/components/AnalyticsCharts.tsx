"use client";

import React from 'react';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { BarChart2, PieChart } from 'lucide-react';

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
  night_surcharge_rate: number;
  sunday_surcharge_start_time: string;
  sunday_surcharge_rate: number;
  holiday_surcharge_start_time: string;
  holiday_surcharge_rate: number;
}

interface AnalyticsChartsProps {
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
}

export default function AnalyticsCharts({
  entries,
  timesheetSettings,
  surchargeSettings
}: AnalyticsChartsProps) {
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
    night_surcharge_rate: 25,
    sunday_surcharge_start_time: '00:00:00',
    sunday_surcharge_rate: 50,
    holiday_surcharge_start_time: '00:00:00',
    holiday_surcharge_rate: 100
  };

  // Group days of current month into 4 weeks
  const getTargetHoursForDate = (date: Date): number => {
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

  // Surcharges & Hours aggregation
  let totalStandardHours = 0;
  let totalNightHours = 0;
  let totalSundayHours = 0;
  let totalHolidayHours = 0;

  // Let's divide month into 4 periods (Weeks)
  const weeklyData = [
    { name: 'Woche 1', actual: 0, target: 0 },
    { name: 'Woche 2', actual: 0, target: 0 },
    { name: 'Woche 3', actual: 0, target: 0 },
    { name: 'Woche 4', actual: 0, target: 0 },
    { name: 'Woche 5', actual: 0, target: 0 },
  ];

  daysInMonth.forEach(day => {
    const dateStr = day.toISOString().split('T')[0];
    const dayNum = day.getDate();
    const target = getTargetHoursForDate(day);
    
    // Find week index
    let weekIdx = 0;
    if (dayNum <= 7) weekIdx = 0;
    else if (dayNum <= 14) weekIdx = 1;
    else if (dayNum <= 21) weekIdx = 2;
    else if (dayNum <= 28) weekIdx = 3;
    else weekIdx = 4;

    weeklyData[weekIdx].target += target;

    const entry = entries.find(e => e.entry_date === dateStr);
    if (entry && !entry.absence_code && entry.end_time) {
      const surch = calculateSurcharges(
        entry.entry_date,
        entry.start_time,
        entry.end_time,
        entry.break_minutes || 0,
        surchSet
      );
      
      weeklyData[weekIdx].actual += surch.workedHours;
      
      totalNightHours += surch.nightHours;
      totalSundayHours += surch.sundayHours;
      totalHolidayHours += surch.holidayHours;
      
      // Standard hours are worked hours minus specialized surcharge overlaps
      // (approximate calculation to avoid overlap subtraction complexity)
      const specialHours = Math.max(surch.nightHours, surch.sundayHours, surch.holidayHours);
      totalStandardHours += Math.max(0, surch.workedHours - specialHours);
    }
  });

  // Calculate percentages for Pie/Donut Chart
  const totalHoursSum = totalStandardHours + totalNightHours + totalSundayHours + totalHolidayHours;
  
  const getDonutSegments = () => {
    if (totalHoursSum === 0) {
      return [
        { label: 'Keine Arbeitszeit erfasst', value: 1, percent: 100, color: 'var(--text-secondary)' }
      ];
    }

    return [
      { label: 'Standardstunden', value: totalStandardHours, percent: (totalStandardHours / totalHoursSum) * 100, color: '#3b82f6' }, // Blue
      { label: 'Nachtarbeit', value: totalNightHours, percent: (totalNightHours / totalHoursSum) * 100, color: '#8b5cf6' },      // Purple
      { label: 'Sonntagsarbeit', value: totalSundayHours, percent: (totalSundayHours / totalHoursSum) * 100, color: '#f59e0b' },    // Amber
      { label: 'Feiertagsarbeit', value: totalHolidayHours, percent: (totalHolidayHours / totalHoursSum) * 100, color: '#ef4444' }   // Red
    ].filter(s => s.value > 0);
  };

  const segments = getDonutSegments();

  // Render variables for Bar Chart
  const maxBarVal = Math.max(...weeklyData.flatMap(w => [w.actual, w.target]), 20);
  const barChartHeight = 150;
  const barChartWidth = 400;
  const padding = 30;

  // Render variables for Donut Chart
  const r = 50;
  const circ = 2 * Math.PI * r; // ~314.159
  let accumulatedPercent = 0;

  return (
    <div className="grid-cols-2" style={{ gap: '2rem', marginBottom: '2rem' }}>
      
      {/* Bar Chart: Soll vs Ist */}
      <div className="glass glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <BarChart2 size={18} className="text-gradient" /> Soll vs. Ist Arbeitsstunden (Wochenübersicht)
        </h3>

        <div style={{ position: 'relative', width: '100%', height: `${barChartHeight + 40}px`, marginTop: 'auto' }}>
          <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight + 40}`} style={{ width: '100%', height: '100%' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding + (1 - ratio) * (barChartHeight - padding);
              const val = Math.round(ratio * maxBarVal);
              return (
                <g key={idx}>
                  <line x1="40" y1={y} x2={barChartWidth - 10} y2={y} stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="10" y={y + 4} fill="var(--text-secondary)" fontSize="10" fontFamily="sans-serif">{val}h</text>
                </g>
              );
            })}

            {/* Bars */}
            {weeklyData.map((w, idx) => {
              const colWidth = (barChartWidth - 50) / weeklyData.length;
              const xBase = 50 + idx * colWidth;
              
              const targetHeight = (w.target / maxBarVal) * (barChartHeight - padding);
              const actualHeight = (w.actual / maxBarVal) * (barChartHeight - padding);
              
              const yTarget = barChartHeight - targetHeight;
              const yActual = barChartHeight - actualHeight;
              
              const barWidth = Math.max(10, colWidth * 0.3);

              return (
                <g key={idx}>
                  {/* Target Bar (Soll) */}
                  <rect
                    x={xBase}
                    y={yTarget}
                    width={barWidth}
                    height={targetHeight}
                    fill="var(--bg-secondary)"
                    rx="3"
                    style={{ transition: 'all 0.5s ease' }}
                  />
                  {/* Actual Bar (Ist) */}
                  <rect
                    x={xBase + barWidth + 4}
                    y={yActual}
                    width={barWidth}
                    height={actualHeight}
                    fill="url(#accentGradient)"
                    rx="3"
                    style={{ transition: 'all 0.5s ease' }}
                  />
                  {/* Label */}
                  <text
                    x={xBase + barWidth}
                    y={barChartHeight + 20}
                    fill="var(--text-secondary)"
                    fontSize="11"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {w.name}
                  </text>
                </g>
              );
            })}

            {/* Definitions */}
            <defs>
              <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" />
                <stop offset="100%" stopColor="var(--accent-secondary)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.85rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Soll-Arbeitszeit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', background: 'var(--accent-gradient)', borderRadius: '3px' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Ist-Arbeitszeit</span>
          </div>
        </div>
      </div>

      {/* Donut Chart: Surcharges breakdown */}
      <div className="glass glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <PieChart size={18} className="text-gradient" /> Arbeitsstunden nach Zuschlags-Kategorie
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: 'auto', marginBottom: 'auto' }}>
          {/* SVG Donut */}
          <div style={{ width: '140px', height: '140px', position: 'relative' }}>
            <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
              {totalHoursSum === 0 ? (
                <circle cx="60" cy="60" r={r} fill="transparent" stroke="var(--bg-secondary)" strokeWidth="12" />
              ) : (
                segments.map((seg, idx) => {
                  const strokeDash = `${(seg.percent / 100) * circ} ${circ}`;
                  const strokeOffset = circ - (accumulatedPercent / 100) * circ;
                  accumulatedPercent += seg.percent;

                  return (
                    <circle
                      key={idx}
                      cx="60"
                      cy="60"
                      r={r}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={strokeDash}
                      strokeDashoffset={strokeOffset}
                      transform="rotate(-90 60 60)"
                      style={{ transition: 'all 0.5s ease', strokeLinecap: 'round' }}
                    />
                  );
                })
              )}
            </svg>
            
            {/* Center Text */}
            <div className="flex-center" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              flexDirection: 'column',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{totalHoursSum.toFixed(1)}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Std. ges.</span>
            </div>
          </div>

          {/* Labels & Values */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            {segments.map((seg, idx) => (
              <div key={idx} className="flex-between" style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', backgroundColor: seg.color, borderRadius: '50%' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{seg.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{seg.value.toFixed(1)}h ({Math.round(seg.percent)}%)</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
