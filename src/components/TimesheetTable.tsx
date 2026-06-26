"use client";

import React, { useState } from 'react';
import { deleteTimeEntryAction } from '@/app/actions';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { Calendar, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  absence_code: string | null;
  note: string | null;
}

interface TimesheetSettings {
  target_hours_monday: number;
  target_hours_tuesday: number;
  target_hours_wednesday: number;
  target_hours_thursday: number;
  target_hours_friday: number;
  target_hours_saturday: number;
  target_hours_sunday: number;
  vacation_days_entitlement: number;
  carry_over_hours: number;
}

interface SurchargeSettings {
  night_surcharge_start_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_start_time: string;
  sunday_surcharge_rate: number;
  holiday_surcharge_start_time: string;
  holiday_surcharge_rate: number;
}

interface TimesheetTableProps {
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
  currentUserId: string;
  isAdmin: boolean;
}

export default function TimesheetTable({
  entries,
  timesheetSettings,
  surchargeSettings,
  currentUserId,
  isAdmin
}: TimesheetTableProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Default settings if null
  const tsSet = timesheetSettings || {
    target_hours_monday: 8,
    target_hours_tuesday: 8,
    target_hours_wednesday: 8,
    target_hours_thursday: 8,
    target_hours_friday: 8,
    target_hours_saturday: 0,
    target_hours_sunday: 0,
    vacation_days_entitlement: 30,
    carry_over_hours: 0
  };

  const surchSet = surchargeSettings || {
    night_surcharge_start_time: '22:00:00',
    night_surcharge_rate: 25,
    sunday_surcharge_start_time: '00:00:00',
    sunday_surcharge_rate: 50,
    holiday_surcharge_start_time: '00:00:00',
    holiday_surcharge_rate: 100
  };

  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Helper to get days in month
  const getDaysInMonth = (y: number, m: number): Date[] => {
    const date = new Date(y, m, 1);
    const days: Date[] = [];
    while (date.getMonth() === m) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInMonth(year, month);

  // Filter entries that belong to this month
  const getEntryForDate = (date: Date): TimeEntry | undefined => {
    const dateString = date.toISOString().split('T')[0];
    return entries.find(e => e.entry_date === dateString);
  };

  // Helper to get target hours of weekday
  const getTargetHoursForDate = (date: Date): number => {
    // If it's a holiday, target hours are 0 (non-working day)
    if (isGermanHoliday(date).isHoliday) {
      return 0;
    }
    
    const day = date.getDay(); // 0-6
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

  // Handle month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Calculations for summary card
  let totalTargetHours = 0;
  let totalWorkedHours = 0;
  let totalOvertime = 0;
  const totalSurchargesHours = { night: 0, sunday: 0, holiday: 0 };
  let totalVacationDays = 0;
  let totalSickDays = 0;

  // Process all days to populate the calculations
  const rows = days.map(day => {
    const entry = getEntryForDate(day);
    const targetHours = getTargetHoursForDate(day);
    let actualHours = 0;
    let overtime = 0;
    let nightH = 0;
    let sundayH = 0;
    let holidayH = 0;
    let displayStatus = '';
    
    const holidayCheck = isGermanHoliday(day);

    if (entry) {
      if (entry.absence_code === 'U') {
        // Vacation counts as target hours met, but actual worked is 0
        actualHours = 0;
        overtime = 0; 
        totalVacationDays++;
        displayStatus = '🏖️ Urlaub';
      } else if (entry.absence_code === 'K') {
        // Sickness counts as target hours met, actual worked is 0
        actualHours = 0;
        overtime = 0;
        totalSickDays++;
        displayStatus = '🤒 Krank';
      } else if (entry.end_time) {
        // Active work entry
        const surch = calculateSurcharges(
          entry.entry_date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0,
          surchSet
        );
        actualHours = surch.workedHours;
        overtime = actualHours - targetHours;
        nightH = surch.nightHours;
        sundayH = surch.sundayHours;
        holidayH = surch.holidayHours;
      } else {
        // Clocked in but not clocked out yet
        displayStatus = '🕒 Aktiv...';
      }
    } else {
      // No entry, check if holiday
      if (holidayCheck.isHoliday) {
        displayStatus = `🎉 ${holidayCheck.name}`;
      } else if (targetHours > 0) {
        // Missing working day
        overtime = -targetHours;
      }
    }

    // Accumulate sums
    totalTargetHours += targetHours;
    totalWorkedHours += actualHours;
    totalOvertime += overtime;
    totalSurchargesHours.night += nightH;
    totalSurchargesHours.sunday += sundayH;
    totalSurchargesHours.holiday += holidayH;

    return {
      day,
      entry,
      targetHours,
      actualHours,
      overtime,
      nightH,
      sundayH,
      holidayH,
      displayStatus,
      holidayName: holidayCheck.name
    };
  });

  const handleDelete = async (id: string) => {
    const res = await deleteTimeEntryAction(id);
    if (res.success) {
      setDeleteConfirm(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Month Selector & Summary Cards */}
      <div className="glass glass-card" style={{ padding: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} className="text-gradient" /> Mein Stundenzettel
          </h2>
          
          <div className="flex-center" style={{ gap: '1rem' }}>
            <button onClick={prevMonth} className="btn btn-secondary glass" style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '150px', textAlign: 'center' }}>
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="btn btn-secondary glass" style={{ padding: '0.5rem', borderRadius: '50%' }}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid-cols-4" style={{ gap: '1rem' }}>
          
          <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Soll-Arbeitszeit</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{totalTargetHours.toFixed(1)} Std.</div>
          </div>
          
          <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Ist-Arbeitszeit</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{totalWorkedHours.toFixed(2)} Std.</div>
          </div>
          
          <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Überstunden Saldo</div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: 700, 
              color: totalOvertime >= 0 ? 'var(--success)' : 'var(--danger)' 
            }}>
              {totalOvertime >= 0 ? '+' : ''}{totalOvertime.toFixed(2)} Std.
            </div>
          </div>

          <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Zuschläge (Stunden)</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                🌙 Nacht: {totalSurchargesHours.night.toFixed(1)}h | ☀️ So: {totalSurchargesHours.sunday.toFixed(1)}h
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                🎉 Feiertag: {totalSurchargesHours.holiday.toFixed(1)}h
              </span>
            </div>
          </div>

        </div>

        {/* Absences Quick Summary */}
        {(totalVacationDays > 0 || totalSickDays > 0) && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', justifyContent: 'flex-end' }}>
            {totalVacationDays > 0 && <span>🏖️ Urlaubstage diesen Monat: <strong>{totalVacationDays}</strong></span>}
            {totalSickDays > 0 && <span>🤒 Krankheitstage diesen Monat: <strong>{totalSickDays}</strong></span>}
          </div>
        )}
      </div>

      {/* Timesheet Spreadsheet Table */}
      <div className="glass glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Datum</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Einstieg</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Ausstieg</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Pause</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Ist-Std.</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Soll-Std.</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Differenz</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Zuschläge</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Notiz / Status</th>
              <th style={{ padding: '0.75rem 0.5rem', width: '60px' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ day, entry, targetHours, actualHours, overtime, nightH, sundayH, holidayH, displayStatus, holidayName }, idx) => {
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const localDayStr = `${weekdays[dayOfWeek]}. ${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}`;
              
              // Highlight style for weekends & holidays
              let rowBg = 'transparent';
              if (holidayName) {
                rowBg = 'rgba(14, 165, 233, 0.05)'; // light info blue
              } else if (isWeekend) {
                rowBg = 'rgba(255, 255, 255, 0.02)';
              }

              // Absence colors
              let statusColor = 'inherit';
              if (entry?.absence_code === 'U') statusColor = 'var(--success)';
              if (entry?.absence_code === 'K') statusColor = 'var(--danger)';

              return (
                <tr key={idx} style={{ 
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                  backgroundColor: rowBg,
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s',
                }}
                className="timesheet-row"
                >
                  {/* Date */}
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                    {localDayStr} {holidayName && <span style={{ fontSize: '0.7rem', color: 'var(--info)', display: 'block' }}>{holidayName}</span>}
                  </td>
                  
                  {/* Start Time */}
                  <td style={{ padding: '0.75rem 0.5rem', color: entry?.absence_code ? 'var(--text-secondary)' : 'inherit' }}>
                    {entry?.absence_code ? '—' : (entry?.start_time ? entry.start_time.slice(0, 5) : '—')}
                  </td>
                  
                  {/* End Time */}
                  <td style={{ padding: '0.75rem 0.5rem', color: entry?.absence_code ? 'var(--text-secondary)' : 'inherit' }}>
                    {entry?.absence_code ? '—' : (entry?.end_time ? entry.end_time.slice(0, 5) : '—')}
                  </td>
                  
                  {/* Break Minutes */}
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {entry?.absence_code || !entry?.end_time ? '—' : `${entry.break_minutes || 0}m`}
                  </td>
                  
                  {/* Worked Hours */}
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                    {entry?.absence_code ? '0.00' : (actualHours > 0 ? actualHours.toFixed(2) : '—')}
                  </td>
                  
                  {/* Target Hours */}
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {targetHours > 0 ? targetHours.toFixed(1) : '—'}
                  </td>
                  
                  {/* Overtime */}
                  <td style={{ 
                    padding: '0.75rem 0.5rem', 
                    textAlign: 'right', 
                    fontWeight: 600,
                    color: overtime > 0 ? 'var(--success)' : (overtime < 0 ? 'var(--danger)' : 'inherit')
                  }}>
                    {entry?.absence_code ? '—' : (overtime !== 0 ? `${overtime > 0 ? '+' : ''}${overtime.toFixed(2)}` : '—')}
                  </td>

                  {/* Surcharges list */}
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    {(nightH > 0 || sundayH > 0 || holidayH > 0) ? (
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        {nightH > 0 && <span title={`Nachtzuschlag: ${nightH}h`} style={{ cursor: 'help' }}>🌙</span>}
                        {sundayH > 0 && <span title={`Sonntagszuschlag: ${sundayH}h`} style={{ cursor: 'help' }}>☀️</span>}
                        {holidayH > 0 && <span title={`Feiertagszuschlag: ${holidayH}h`} style={{ cursor: 'help' }}>🎉</span>}
                      </div>
                    ) : '—'}
                  </td>

                  {/* Note / Status */}
                  <td style={{ padding: '0.75rem 0.5rem', color: statusColor, fontStyle: entry?.absence_code ? 'italic' : 'normal', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayStatus || entry?.note || '—'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {entry && (entry.user_id === currentUserId || isAdmin) && (
                      <div style={{ position: 'relative' }}>
                        {deleteConfirm === entry.id ? (
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '-35px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--danger)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            zIndex: 10,
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>Löschen?</span>
                            <button 
                              onClick={() => handleDelete(entry.id)} 
                              style={{ border: 'none', background: 'var(--danger)', color: 'white', padding: '0.1rem 0.3rem', fontSize: '0.7rem', borderRadius: '2px', cursor: 'pointer' }}
                            >
                              Ja
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(null)} 
                              style={{ border: 'none', background: 'var(--text-secondary)', color: 'white', padding: '0.1rem 0.3rem', fontSize: '0.7rem', borderRadius: '2px', cursor: 'pointer' }}
                            >
                              Nein
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(entry.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              transition: 'color 0.2s',
                            }}
                            title="Eintrag löschen"
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
