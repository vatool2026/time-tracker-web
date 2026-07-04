"use client";

import React, { useState, useMemo } from 'react';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface YearlyOverviewTableProps {
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings;
  surchargeSettings: SurchargeSettings;
  absenceCodes: AbsenceCode[];
  startDate?: string | null;
  payouts?: { id: string; user_id: string; year: number; month: number; hours: number; note: string | null; created_at: string; }[];
  companyState?: string;
  companyHolidays?: any[];
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

// Helper to format float hours into HH:MM
const formatHours = (hours: number): string => {
  if (hours === 0) return '';
  const isNegative = hours < 0;
  const absHours = Math.abs(hours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  const sign = isNegative ? '-' : '';
  // Avoid "-0:00"
  if (h === 0 && m === 0) return '0:00';
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
};

export default function YearlyOverviewTable({
  entries,
  timesheetSettings,
  surchargeSettings,
  absenceCodes,
  startDate,
  payouts = [],
  companyState,
  companyHolidays
}: YearlyOverviewTableProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [mobileMonthIdx, setMobileMonthIdx] = useState(new Date().getMonth());

  const gridData = useMemo(() => {
    const data: any = {
      months: Array(12).fill(null).map(() => ({
        days: Array(31).fill(null),
        summary: {
          soll: 0,
          ist: 0,
          overtime: 0,
          anwesend: 0,
          krank: 0,
          urlaub: 0,
          gleittag: 0,
          payout: 0
        }
      }))
    };

    // Calculate per-day data
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const date = new Date(year, m, d);
        // Check if date is valid for this month
        if (date.getMonth() !== m) {
          data.months[m].days[d - 1] = null;
          continue;
        }

        const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        const dayEntries = entries.filter(e => e.entry_date === dateStr && !e.deleted_at);
        const isHoliday = isGermanHoliday(date, companyState, companyHolidays);
        
        // Calculate target hours
        let baseTargetHours = 0;
        
        // Skip target hours if before start date
        if (startDate && new Date(dateStr) < new Date(startDate)) {
          baseTargetHours = 0;
        } else {
          switch (date.getDay()) {
            case 1: baseTargetHours = timesheetSettings.target_hours_monday; break;
            case 2: baseTargetHours = timesheetSettings.target_hours_tuesday; break;
            case 3: baseTargetHours = timesheetSettings.target_hours_wednesday; break;
            case 4: baseTargetHours = timesheetSettings.target_hours_thursday; break;
            case 5: baseTargetHours = timesheetSettings.target_hours_friday; break;
            case 6: baseTargetHours = timesheetSettings.target_hours_saturday; break;
            case 0: baseTargetHours = timesheetSettings.target_hours_sunday; break;
          }
          if (isHoliday.isHoliday) {
            if (isHoliday.isHalfHoliday) {
              baseTargetHours = baseTargetHours / 2;
            } else {
              baseTargetHours = 0;
            }
          }
        }

        let actualHours = 0;
        let cellDisplay = '';
        let targetHours = baseTargetHours;
        let isAnwesend = false;

        if (dayEntries.length > 0) {
          // Process entries for this day
          // For simplicity, we just look at the first non-dummy entry or an absence code
          const entryWithAbsence = dayEntries.find(e => e.absence_code);
          if (entryWithAbsence) {
            const codeObj = absenceCodes.find(c => c.code === entryWithAbsence.absence_code);
            if (codeObj) {
              targetHours = targetHours * codeObj.factor;
              cellDisplay = codeObj.code;
              if (codeObj.code === 'U') data.months[m].summary.urlaub += 1;
              if (codeObj.code === 'K' || codeObj.code === 'KR') data.months[m].summary.krank += 1;
              if (codeObj.code === 'G') data.months[m].summary.gleittag += 1;
            } else {
              cellDisplay = entryWithAbsence.absence_code || '';
            }
          }

          dayEntries.forEach(entry => {
            if (entry.end_time && entry.end_time !== '00:00:00') {
              const surch = calculateSurcharges(
                entry.entry_date,
                entry.start_time,
                entry.end_time,
                entry.break_minutes || 0,
                surchargeSettings
              );
              // Simple aggregation of worked hours
              actualHours += surch.workedHoursDay1 + surch.workedHoursDay2;
              if (!cellDisplay) {
                // Formatting actual hours like "8:15"
                // Or just show actualHours formatted 
                const workedStr = formatHours(surch.workedHoursDay1 + surch.workedHoursDay2);
                cellDisplay = workedStr;
              }
              isAnwesend = true;
            } else if (entry.start_time && entry.start_time !== '00:00:00' && !cellDisplay && !entry.end_time) {
              // Active entry
              cellDisplay = entry.start_time.substring(0, 5) + '...';
            }
          });
        }

        if (isHoliday.isHoliday && !cellDisplay) {
          cellDisplay = 'F';
        }

        // Overtime is actualHours - targetHours
        const overtime = actualHours - targetHours;

        data.months[m].days[d - 1] = {
          weekday: date.getDay(),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          isHoliday: isHoliday.isHoliday,
          display: cellDisplay,
          targetHours,
          actualHours
        };

        // Summaries
        data.months[m].summary.soll += targetHours;
        data.months[m].summary.ist += actualHours;
        data.months[m].summary.overtime += overtime;
        if (isAnwesend) {
          data.months[m].summary.anwesend += 1;
        }
      }

      const monthlyPayout = payouts
        .filter(p => p.year === year && p.month === m + 1)
        .reduce((sum, p) => sum + p.hours, 0);
      
      data.months[m].summary.payout = monthlyPayout;
      data.months[m].summary.overtime -= monthlyPayout;
    }

    return data;
  }, [year, entries, timesheetSettings, surchargeSettings, absenceCodes, startDate, payouts]);

  const totalSoll = gridData.months.reduce((acc: number, m: any) => acc + m.summary.soll, 0);
  const totalIst = gridData.months.reduce((acc: number, m: any) => acc + m.summary.ist, 0);
  const totalOvertime = gridData.months.reduce((acc: number, m: any) => acc + m.summary.overtime, 0);
  const totalAnwesend = gridData.months.reduce((acc: number, m: any) => acc + m.summary.anwesend, 0);
  const totalKrank = gridData.months.reduce((acc: number, m: any) => acc + m.summary.krank, 0);
  const totalUrlaub = gridData.months.reduce((acc: number, m: any) => acc + m.summary.urlaub, 0);
  const totalGleittag = gridData.months.reduce((acc: number, m: any) => acc + m.summary.gleittag, 0);

  return (
    <div className="glass glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => setYear(y => y - 1)} style={{ padding: '0.5rem' }}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="hidden-mobile" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Jahresübersicht {year}</h2>
        <h2 className="mobile-only" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Monatsübersicht {year}</h2>
        <button className="btn btn-secondary" onClick={() => setYear(y => y + 1)} style={{ padding: '0.5rem' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mobile-scroll-nav hidden-mobile" style={{ width: '100%', overflowX: 'auto', paddingBottom: '1rem' }}>
        <table style={{ width: '100%', minWidth: '1000px', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
          <colgroup>
            <col style={{ width: '130px' }} />
            {Array.from({ length: 24 }).map((_, i) => (
              <col key={i} />
            ))}
            <col style={{ width: '80px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>Tag</th>
              {MONTHS.map(m => (
                <th key={m} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                  {m}
                </th>
              ))}
              <th style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>Summe</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <tr key={day}>
                <td style={{ border: '1px solid var(--glass-border)', padding: '0.25rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)' }}>{day}</td>
                
                {gridData.months.map((monthData: any, mIdx: number) => {
                  const cell = monthData.days[day - 1];
                  if (!cell) {
                    return (
                      <React.Fragment key={mIdx}>
                        <td colSpan={2} style={{ border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-tertiary)' }}></td>
                      </React.Fragment>
                    );
                  }

                  const isHighlight = cell.isWeekend || cell.isHoliday;
                  const bg = isHighlight ? 'rgba(255, 255, 255, 0.15)' : 'transparent'; // Light gray highlight
                  const color = cell.display === 'F' ? 'var(--warning-color)' : (cell.display === 'U' || cell.display === 'K' || cell.display === 'KR' || cell.display === 'G' ? 'var(--primary-color)' : 'inherit');

                  return (
                    <React.Fragment key={mIdx}>
                      <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.25rem', backgroundColor: bg }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)', width: '22px', textAlign: 'left', flexShrink: 0, fontSize: '0.7rem' }}>{WEEKDAYS[cell.weekday]}</span>
                          <span style={{ fontWeight: 500, color: color, flex: 1, textAlign: 'center', paddingRight: '22px' }}>{cell.display}</span>
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}

                <td style={{ border: '1px solid var(--glass-border)', padding: '0.25rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)' }}>{day}</td>
              </tr>
            ))}

            {/* Summary Rows */}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--glass-border)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }} colSpan={1}>
                SOLL-Arbeitszeit
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 500 }}>
                  {formatHours(m.summary.soll)}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {formatHours(totalSoll)}
              </td>
            </tr>

            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }} colSpan={1}>
                IST-Arbeitszeit
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 500 }}>
                  {formatHours(m.summary.ist)}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {formatHours(totalIst)}
              </td>
            </tr>

            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }} colSpan={1}>
                +/-
              </td>
              {gridData.months.map((m: any, idx: number) => {
                const isNeg = m.summary.overtime < 0;
                return (
                  <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: m.summary.overtime < -0.01 ? 'var(--error-color)' : (m.summary.overtime > 0.01 ? 'var(--success-color)' : 'inherit') }}>
                    {m.summary.overtime !== 0 ? (m.summary.overtime > 0.01 ? '+' : '') + formatHours(m.summary.overtime) : '0:00'}
                  </td>
                );
              })}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: totalOvertime < -0.01 ? 'var(--error-color)' : (totalOvertime > 0.01 ? 'var(--success-color)' : 'inherit') }}>
                {totalOvertime !== 0 ? (totalOvertime > 0.01 ? '+' : '') + formatHours(totalOvertime) : '0:00'}
              </td>
            </tr>

            {gridData.months.some((m: any) => m.summary.payout > 0) && (
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem' }} colSpan={1}>
                  Davon Ausgezahlt
                </td>
                {gridData.months.map((m: any, idx: number) => (
                  <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: m.summary.payout > 0 ? 'var(--accent-primary)' : 'inherit', fontSize: '0.7rem' }}>
                    {m.summary.payout > 0 ? formatHours(m.summary.payout) : '-'}
                  </td>
                ))}
                <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                  {formatHours(gridData.months.reduce((acc: number, m: any) => acc + m.summary.payout, 0))}
                </td>
              </tr>
            )}

            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }} colSpan={1}>
                Anwesenheitstage
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem' }}>
                  {m.summary.anwesend > 0 ? m.summary.anwesend : ''}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {totalAnwesend > 0 ? totalAnwesend : ''}
              </td>
            </tr>

            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }} colSpan={1}>
                Urlaub (U)
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem' }}>
                  {m.summary.urlaub > 0 ? m.summary.urlaub : ''}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {totalUrlaub > 0 ? totalUrlaub : ''}
              </td>
            </tr>

            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }} colSpan={1}>
                Krank (K)
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem' }}>
                  {m.summary.krank > 0 ? m.summary.krank : ''}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {totalKrank > 0 ? totalKrank : ''}
              </td>
            </tr>

            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }} colSpan={1}>
                Gleittag (G)
              </td>
              {gridData.months.map((m: any, idx: number) => (
                <td key={idx} colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem' }}>
                  {m.summary.gleittag > 0 ? m.summary.gleittag : ''}
                </td>
              ))}
              <td colSpan={1} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>
                {totalGleittag > 0 ? totalGleittag : ''}
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: 'var(--border-radius-md)' }}>
          <button className="btn btn-secondary" onClick={() => setMobileMonthIdx(m => Math.max(0, m - 1))} disabled={mobileMonthIdx === 0} style={{ padding: '0.5rem' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600 }}>{MONTHS[mobileMonthIdx]}</span>
          <button className="btn btn-secondary" onClick={() => setMobileMonthIdx(m => Math.min(11, m + 1))} disabled={mobileMonthIdx === 11} style={{ padding: '0.5rem' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>Tag</th>
              <th colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>{MONTHS[mobileMonthIdx]}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
              const monthData = gridData.months[mobileMonthIdx];
              const cell = monthData.days[day - 1];
              if (!cell) {
                return (
                  <tr key={day}>
                    <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)' }}>{day}</td>
                    <td colSpan={2} style={{ border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-tertiary)' }}></td>
                  </tr>
                );
              }
              const isHighlight = cell.isWeekend || cell.isHoliday;
              const bg = isHighlight ? 'rgba(255, 255, 255, 0.15)' : 'transparent';
              const color = cell.display === 'F' ? 'var(--warning-color)' : (cell.display === 'U' || cell.display === 'K' || cell.display === 'KR' || cell.display === 'G' ? 'var(--primary-color)' : 'inherit');
              return (
                <tr key={day}>
                  <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', textAlign: 'center' }}>{day}</td>
                  <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', backgroundColor: bg }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', width: '28px', textAlign: 'left', fontWeight: 400, flexShrink: 0 }}>{WEEKDAYS[cell.weekday]}</span>
                      <span style={{ color: color, fontWeight: 500, flex: 1, textAlign: 'center', paddingRight: '28px' }}>{cell.display}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--glass-border)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>SOLL</td>
              <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>{formatHours(gridData.months[mobileMonthIdx].summary.soll)}</td>
            </tr>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>IST</td>
              <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>{formatHours(gridData.months[mobileMonthIdx].summary.ist)}</td>
            </tr>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600 }}>Diff</td>
              <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: gridData.months[mobileMonthIdx].summary.overtime >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {gridData.months[mobileMonthIdx].summary.overtime > 0 ? '+' : ''}{formatHours(gridData.months[mobileMonthIdx].summary.overtime)}
              </td>
            </tr>
            {gridData.months[mobileMonthIdx].summary.payout > 0 && (
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <td style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, fontSize: '0.75rem' }}>Davon Ausgezahlt</td>
                <td colSpan={2} style={{ border: '1px solid var(--glass-border)', padding: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.75rem' }}>
                  {formatHours(gridData.months[mobileMonthIdx].summary.payout)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-only" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>Jahresübersicht (Gesamt)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid var(--glass-border)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>SOLL-Arbeitszeit</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center' }}>{formatHours(totalSoll)}</td>
            </tr>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>IST-Arbeitszeit</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center' }}>{formatHours(totalIst)}</td>
            </tr>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Differenz</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center', color: totalOvertime >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {totalOvertime > 0 ? '+' : ''}{formatHours(totalOvertime)}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Urlaub (U)</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{totalUrlaub > 0 ? totalUrlaub : '0'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Krank (K)</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{totalKrank > 0 ? totalKrank : '0'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'left' }}>Gleittage (G)</td>
              <td style={{ border: '1px solid var(--glass-border)', padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{totalGleittag > 0 ? totalGleittag : '0'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
