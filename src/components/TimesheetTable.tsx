"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  deleteTimeEntryAction, 
  updateTimeEntryAction, 
  createManualTimeEntryAction,
  setDayAbsenceCodeAction
} from '@/app/actions';
import { addOfflineAction } from '@/utils/offlineQueue';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Trash2, Edit3 } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface TimeEntry {
  id: string;
  original_id?: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  original_start_time?: string;
  end_time: string | null;
  original_end_time?: string | null;
  isSpillover?: boolean;
  break_minutes: number;
  break_logs?: any[];
  absence_code: string | null;
  note: string | null;
  edit_reason?: string | null;
  deleted_at?: string | null;
  delete_reason?: string | null;
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
  carry_over_vacation_days?: number;
  carry_over_hours: number;
}

interface SurchargeSettings {
  night_surcharge_start_time: string;
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
}

export interface AbsenceCode {
  id: string;
  company_id: string;
  employment_category: string;
  name: string;
  code: string;
  factor: number;
}

interface OvertimePayout {
  id: string;
  user_id: string;
  year: number;
  month: number;
  hours: number;
  note: string | null;
  created_at: string;
}

interface TimesheetTableProps {
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
  currentUserId: string;
  isAdmin?: boolean;
  absenceCodes?: AbsenceCode[] | null;
  startDate?: string | null;
  payouts?: OvertimePayout[];
  companyHolidays?: any[] | null;
  companyState?: string;
}

export default function TimesheetTable({
  entries,
  timesheetSettings,
  surchargeSettings,
  currentUserId,
  isAdmin = false,
  absenceCodes = null,
  startDate,
  payouts = [],
  companyHolidays,
  companyState
}: TimesheetTableProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [monthlyBalance, setMonthlyBalance] = useState<any>(null);

  const toggleRow = (dateStr: string) => {
    const newSet = new Set(expandedDates);
    if (newSet.has(dateStr)) newSet.delete(dateStr);
    else newSet.add(dateStr);
    setExpandedDates(newSet);
  };

  // Edit modal state
  const [editingDateStr, setEditingDateStr] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<TimeEntry[]>([]);
  const [formMode, setFormMode] = useState<'IDLE' | 'EDIT' | 'NEW'>('IDLE');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editBreakMinutes, setEditBreakMinutes] = useState(0);
  const [editNote, setEditNote] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  useEffect(() => {
    // Fetch carry-over from PREVIOUS month
    const fetchBalance = async () => {
      const supabase = createClient();
      let prevYear = year;
      let prevMonth = month; // Since month is 0-indexed, if current is Jan (0), prev is Dec (12 of prev year in our DB logic)
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      
      const { data } = await supabase
        .from('monthly_time_balances')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('year', prevYear)
        .eq('month', prevMonth)
        .maybeSingle();
      
      if (data) setMonthlyBalance(data);
      else setMonthlyBalance(null);
    };
    fetchBalance();
  }, [year, month, currentUserId]);

  const realCurrentDate = new Date();
  const currentRealYear = realCurrentDate.getFullYear();
  const currentRealMonth = realCurrentDate.getMonth();

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
    carry_over_vacation_days: 0,
    carry_over_hours: 0
  };

  const surchSet = surchargeSettings || {
    night_surcharge_start_time: '22:00:00',
    night_surcharge_end_time: '06:00:00',
    night_surcharge_rate: 25,
    sunday_surcharge_rate: 50,
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

  // Helper to format Date to YYYY-MM-DD in local time
  const formatLocalDate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filter entries that belong to this month
  const getEntriesForDate = (date: Date): TimeEntry[] => {
    const dateString = formatLocalDate(date);
    return entries.filter(e => e.entry_date === dateString);
  };

  // Helper to get target hours of weekday
  const getTargetHoursForDate = (date: Date): number => {
    // If before start date, target is 0
    if (startDate) {
      const dStr = formatLocalDate(date);
      if (new Date(dStr) < new Date(startDate)) return 0;
    }

    // If it's a holiday, target hours are 0 (non-working day) or halved
    const holidayInfo = isGermanHoliday(date, companyState, companyHolidays || undefined);
    if (holidayInfo.isHoliday && !holidayInfo.isHalfHoliday) {
      return 0;
    }
    
    let regularTarget = 0;
    const day = date.getDay(); // 0-6
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

  // Handle navigation
  const prevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  const nextYear = () => setCurrentDate(new Date(year + 1, month, 1));
  const setMonth = (m: number) => setCurrentDate(new Date(year, m, 1));

  // Calculations for summary card
  let totalTargetHours = 0;
  let totalWorkedHours = 0;
  
  // --- Historical Overtime Calculation ---
  // Build a map of active entries by date for fast lookup
  const activeEntriesByDate = new Map<string, any[]>();
  entries.forEach(e => {
    if (!e.deleted_at) {
      if (!activeEntriesByDate.has(e.entry_date)) {
        activeEntriesByDate.set(e.entry_date, []);
      }
      activeEntriesByDate.get(e.entry_date)!.push(e);
    }
  });

  let calcStartDateStr = startDate;
  if (!calcStartDateStr) {
    const sortedDates = Array.from(activeEntriesByDate.keys()).sort();
    calcStartDateStr = sortedDates.length > 0 ? sortedDates[0] : `${currentDate.getFullYear()}-01-01`;
  }

  const calcStart = new Date(calcStartDateStr);
  const calcEnd = new Date(year, month, 0); // last day of PREVIOUS month
  let historicalOvertime = tsSet.carry_over_hours || 0;

  // Subtract past payouts
  const pastPayouts = payouts.filter(p => p.year < year || (p.year === year && p.month < month + 1));
  const pastPayoutsTotal = pastPayouts.reduce((sum, p) => sum + p.hours, 0);
  historicalOvertime -= pastPayoutsTotal;

  if (calcStart <= calcEnd) {
    for (let d = new Date(calcStart); d <= calcEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);
      let dayTarget = getTargetHoursForDate(d);
      let dayWorked = 0;
      
      const dayEntries = activeEntriesByDate.get(dateStr) || [];
      
      if (dayEntries.length > 0) {
        let codeFactor = 1.0;
        const codeStr = dayEntries[0].absence_code;
        if (codeStr && absenceCodes) {
          const dayCodeObj = absenceCodes.find(c => c.code === codeStr);
          if (dayCodeObj) codeFactor = dayCodeObj.factor;
        }
        dayTarget = dayTarget * codeFactor;
        
        dayEntries.forEach(entry => {
          if (!entry.absence_code && entry.end_time) {
            const surch = calculateSurcharges(entry.entry_date, entry.start_time, entry.end_time, entry.break_minutes || 0, surchSet, undefined, undefined, entry.break_logs);
            dayWorked += surch.workedHoursDay1 + surch.workedHoursDay2;
          }
        });
      }
      
      historicalOvertime += (dayWorked - dayTarget);
    }
  }

  let totalOvertime = historicalOvertime;
  // --- End Historical Overtime Calculation ---

  const totalSurchargesHours = { night: 0, sunday: 0, holiday: 0 };
  let totalVacationDays = 0;
  let totalSickDays = 0;

  // Track all used abbreviations in the selected month
  const abbreviationCounts: Record<string, { name: string; code: string; count: number; factor: number }> = {};
  let attendanceDays = 0;

  // Calculate remaining vacation days up to the end of the currently displayed month
  const currentYearStr = year.toString();
  const takenVacationDaysUpToMonthEnd = entries.filter(e => {
    if (e.deleted_at || e.absence_code !== 'U') return false;
    if (!e.entry_date.startsWith(currentYearStr)) return false;
    const entryMonth = parseInt(e.entry_date.split('-')[1], 10) - 1;
    return entryMonth <= month;
  }).length;
  
  const totalVacationEntitlement = (tsSet.vacation_days_entitlement || 0) + (tsSet.carry_over_vacation_days || 0);
  const remainingVacationDays = totalVacationEntitlement - takenVacationDaysUpToMonthEnd;

  // Process all days to populate the calculations
  const rows = days.map(day => {
    // 1. Get all entries for this day
    const allEntriesList = getEntriesForDate(day);
    
    // Filter active and deleted
    const activeEntriesList = allEntriesList.filter(e => !e.deleted_at);
    const deletedEntriesList = isAdmin ? allEntriesList.filter(e => e.deleted_at) : [];
    
    let targetHours = getTargetHoursForDate(day);
    let actualHours = 0;
    let overtime = 0;
    let nightH = 0;
    let sundayH = 0;
    let holidayH = 0;
    let displayStatus = '';
    let startTime = '';
    let endTime = '';
    let totalBreak = 0;
    
    const holidayCheck = isGermanHoliday(day, companyState, companyHolidays || undefined);
    const isHoliday = holidayCheck.isHoliday;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const dayEntriesList: any[] = [];

    if (activeEntriesList.length > 0) {
      let codeFactor = 1.0;
      let dayHasAbsenceCode = false;
      const codeStr = activeEntriesList[0].absence_code;
      
      if (codeStr && absenceCodes) {
        const dayCodeObj = absenceCodes.find(c => c.code === codeStr);
        if (dayCodeObj) {
          codeFactor = dayCodeObj.factor;
          displayStatus = `✨ ${dayCodeObj.name}`;
          dayHasAbsenceCode = true;
          if (codeStr === 'U') totalVacationDays++;
          if (codeStr === 'K') totalSickDays++;

          if (!abbreviationCounts[codeStr]) {
            abbreviationCounts[codeStr] = { name: dayCodeObj.name, code: dayCodeObj.code, count: 0, factor: dayCodeObj.factor };
          }
          abbreviationCounts[codeStr].count++;
        }
      }

      // Apply the factor to target hours
      targetHours = targetHours * codeFactor;

      activeEntriesList.forEach(entry => {
        if (dayHasAbsenceCode && entry.start_time === '00:00:00' && entry.end_time === '00:00:00' && entry.break_minutes === 0) {
          // This is a dummy entry to hold the absence code
          dayEntriesList.push({ ...entry, entry_actual_hours: 0, entry_break_minutes: 0 });
        } else if (entry.end_time) {
          const surch = calculateSurcharges(
            entry.entry_date,
            entry.start_time,
            entry.end_time,
            entry.break_minutes || 0,
            surchSet,
            undefined,
            undefined,
            entry.break_logs
          );
          const totalWorkedForEntry = surch.workedHoursDay1 + surch.workedHoursDay2;
          const totalNightForEntry = surch.nightHoursDay1 + surch.nightHoursDay2;
          const totalSunForEntry = surch.sundayHoursDay1 + surch.sundayHoursDay2;
          const totalHolForEntry = surch.holidayHoursDay1 + surch.holidayHoursDay2;

          actualHours += totalWorkedForEntry;
          nightH += totalNightForEntry;
          sundayH += totalSunForEntry;
          holidayH += totalHolForEntry;
          totalBreak += entry.break_minutes || 0;

          if (entry.end_time >= entry.start_time) {
            dayEntriesList.push({
              ...entry,
              original_id: entry.id,
              original_end_time: entry.end_time,
              entry_actual_hours: totalWorkedForEntry,
              entry_break_minutes: entry.break_minutes || 0,
              entry_nightH: totalNightForEntry,
              entry_sundayH: totalSunForEntry,
              entry_holidayH: totalHolForEntry,
              nightIntervals: surch.nightIntervals,
              sundayIntervals: surch.sundayIntervals,
              holidayIntervals: surch.holidayIntervals
            });
          } else {
            // Spillover: push two parts so they appear in sub-rows
            dayEntriesList.push({
              ...entry,
              original_id: entry.id,
              end_time: '24:00:00',
              original_end_time: entry.end_time,
              entry_actual_hours: surch.workedHoursDay1,
              entry_break_minutes: entry.break_minutes || 0,
              entry_nightH: surch.nightHoursDay1,
              entry_sundayH: surch.sundayHoursDay1,
              entry_holidayH: surch.holidayHoursDay1,
              nightIntervals: surch.nightIntervals,
              sundayIntervals: surch.sundayIntervals,
              holidayIntervals: surch.holidayIntervals,
              isSplitPart1: true
            });
            dayEntriesList.push({
              ...entry,
              id: entry.id + '-part2',
              original_id: entry.id,
              start_time: '00:00:00',
              original_start_time: entry.start_time,
              entry_actual_hours: surch.workedHoursDay2,
              entry_break_minutes: 0,
              entry_nightH: surch.nightHoursDay2,
              entry_sundayH: surch.sundayHoursDay2,
              entry_holidayH: surch.holidayHoursDay2,
              nightIntervals: surch.nightIntervals,
              sundayIntervals: surch.sundayIntervals,
              holidayIntervals: surch.holidayIntervals,
              isSplitPart2: true
            });
          }
        } else {
          displayStatus = '🕒 Aktiv...';
          dayEntriesList.push({ ...entry, entry_actual_hours: 0, entry_break_minutes: 0 });
        }
      });
    }

    if (deletedEntriesList.length > 0) {
      deletedEntriesList.forEach(entry => {
        dayEntriesList.push({
          ...entry,
          original_id: entry.id,
          entry_actual_hours: 0,
          entry_break_minutes: entry.break_minutes || 0,
          entry_nightH: 0,
          entry_sundayH: 0,
          entry_holidayH: 0
        });
      });
    }

    if (dayEntriesList.length > 0) {
      // Calculate earliest start and latest end for active entries only
      const activeOnly = dayEntriesList.filter(e => !e.deleted_at);
      const sorted = [...activeOnly].sort((a,b) => a.start_time.localeCompare(b.start_time));
      
      // If it's just dummy entries, don't set start/end times
      const nonDummy = sorted.filter(e => !(e.start_time === '00:00:00' && e.end_time === '00:00:00'));
      if (nonDummy.length > 0) {
        startTime = nonDummy[0].start_time;
        const withEnd = nonDummy.filter(e => e.end_time);
        if (withEnd.length > 0) {
          const latest = [...withEnd].sort((a,b) => b.end_time.localeCompare(a.end_time))[0];
          endTime = latest.end_time;
        }
      }
      
      overtime = actualHours - targetHours;
      
      // combine notes and reasons
      const notes = dayEntriesList
        .filter(e => !e.deleted_at)
        .map(e => e.note)
        .filter(Boolean)
        .filter(note => !(note && note.startsWith('Code: ')));
        
      const reasons = dayEntriesList.filter(e => !e.deleted_at).map(e => e.edit_reason).filter(Boolean);
      
      const allNotes = notes.length > 0 ? notes.join(' | ') : '';
      const allReasons = reasons.length > 0 ? '✏️' : '';
      const deletedInfo = deletedEntriesList.length > 0 ? `[Gelöscht: ${deletedEntriesList.map(e => e.delete_reason || 'Kein Grund').join(', ')}]` : '';
      
      const parts = [allNotes, allReasons, deletedInfo].filter(Boolean);
      if (!displayStatus) displayStatus = parts.join(' | ');
      else if (parts.length > 0) displayStatus += ' | ' + parts.join(' | ');
    } else {
      // No entry, check if holiday
      if (holidayCheck.isHoliday) {
        displayStatus = `🎉 ${holidayCheck.name}`;
      } else if (targetHours > 0) {
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

    if (actualHours > 0) {
      attendanceDays++;
    }

    return {
      day,
      dayEntriesList,
      activeEntriesList,
      targetHours,
      actualHours,
      overtime,
      nightH,
      sundayH,
      holidayH,
      displayStatus,
      holidayName: holidayCheck.name,
      startTime,
      endTime,
      totalBreak,
      isAbsence: dayEntriesList.some(e => e.absence_code)
    };
  });

  const currentMonthPayouts = payouts.filter(p => p.year === year && p.month === month + 1 && p.user_id === currentUserId);
  const currentMonthPayoutTotal = currentMonthPayouts.reduce((sum, p) => sum + p.hours, 0);
  totalOvertime -= currentMonthPayoutTotal;

  const [deleteReasonText, setDeleteReasonText] = useState<string>('');

  const handleDelete = async (id: string) => {
    if (!deleteReasonText || deleteReasonText.trim() === '') {
      setEditError('Ein Grund für das Löschen muss angegeben werden.');
      return;
    }

    const res = await deleteTimeEntryAction(id, deleteReasonText);
    if (res.success) {
      setDeleteConfirm(null);
      setDeleteReasonText('');
      // Update local modal state 
      setDayEntries(prev => {
         const newEntries = [...prev];
         const index = newEntries.findIndex(e => (e.original_id || e.id) === id);
         if (index !== -1) {
             if (isAdmin) {
                 newEntries[index] = { ...newEntries[index], deleted_at: new Date().toISOString(), delete_reason: deleteReasonText };
             } else {
                 newEntries.splice(index, 1);
             }
         }
         return newEntries;
      });
      router.refresh();
    } else {
      setEditError(res.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDateStr) return;
    if (!editReason || editReason.trim() === '') {
      setEditError('Ein Grund für die Änderung muss angegeben werden.');
      return;
    }
    
    setEditError('');
    let res;
    
    if (formMode === 'EDIT' && editingEntryId) {
      res = await updateTimeEntryAction(
        editingEntryId,
        editStartTime,
        editEndTime,
        editBreakMinutes,
        editNote,
        editReason
      );
    } else if (formMode === 'NEW') {
      res = await createManualTimeEntryAction(
        currentUserId,
        editingDateStr,
        editStartTime,
        editEndTime,
        editBreakMinutes,
        editNote,
        editReason
      );
    } else {
      return;
    }
    
    if (res.success) {
      // Close modal and refresh to fetch new entries
      setEditingDateStr(null);
      setFormMode('IDLE');
      router.refresh();
    } else {
      setEditError(res.message);
    }
  };
  
  const openDayModal = (day: Date, entriesList: TimeEntry[]) => {
    const dateStr = formatLocalDate(day);
    setEditingDateStr(dateStr);
    setDayEntries(entriesList);
    setFormMode('IDLE');
    setEditError('');
  };

  const handleSetAbsenceCode = async (code: string) => {
    if (!editingDateStr) return;
    setEditError('');

    if (!navigator.onLine) {
      await addOfflineAction('setDayAbsenceCodeAction', { userId: currentUserId, dateStr: editingDateStr, code: code || null });
      setEditingDateStr(null);
      alert('Aktion offline gespeichert. Wird synchronisiert, sobald wieder Empfang besteht.');
      return;
    }

    const res = await setDayAbsenceCodeAction(currentUserId, editingDateStr, code || null);
    if (res.success) {
      // Close modal and refresh
      setEditingDateStr(null);
      router.refresh();
    } else {
      setEditError(res.message);
    }
  };

  const handleRowAbsenceCode = async (dateStr: string, code: string) => {
    if (!navigator.onLine) {
      await addOfflineAction('setDayAbsenceCodeAction', { userId: currentUserId, dateStr: dateStr, code: code || null });
      alert('Aktion offline gespeichert. Wird synchronisiert, sobald wieder Empfang besteht.');
      return;
    }

    const res = await setDayAbsenceCodeAction(currentUserId, dateStr, code || null);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.message);
    }
  };
  const startEditEntry = (entry: TimeEntry) => {
    setFormMode('EDIT');
    setEditingEntryId(entry.original_id || entry.id);
    
    const startStr = entry.original_start_time || entry.start_time;
    const endStr = entry.original_end_time || entry.end_time;
    
    setEditStartTime(startStr ? startStr.slice(0, 5) : '08:00');
    setEditEndTime(endStr ? endStr.slice(0, 5) : '16:00');
    setEditBreakMinutes(entry.break_minutes || 0);
    setEditNote(entry.note || '');
    setEditReason('');
    setEditError('');
  };

  const startNewEntry = () => {
    setFormMode('NEW');
    setEditingEntryId(null);
    setEditStartTime('08:00');
    setEditEndTime('16:00');
    setEditBreakMinutes(0);
    setEditNote('');
    setEditReason('');
    setEditError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Year & Month Selectors */}
      <div className="glass glass-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="flex-between" style={{ alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1.2 }}>
              <span className="hidden-mobile"><Calendar size={22} className="text-gradient" /></span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Mein</span>
                <span>Stundenzettel</span>
              </span>
            </h2>
            
            <div className="flex-center" style={{ gap: '0.75rem', marginTop: '0.25rem' }}>
              <button onClick={prevYear} className="btn btn-secondary glass" style={{ padding: '0.4rem', borderRadius: '50%' }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '60px', textAlign: 'center' }}>
                {year}
              </span>
              <button onClick={nextYear} className="btn btn-secondary glass" style={{ padding: '0.4rem', borderRadius: '50%' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Month Selector - Desktop Row, Mobile Dropdown */}
          <div className="hidden-mobile" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            {monthNames.map((mName, idx) => {
              const isCurrentRealMonth = year === currentRealYear && idx === currentRealMonth;
              const isSelected = idx === month;
              
              let btnClass = isSelected ? 'btn-primary' : 'btn-secondary glass';
              let style: React.CSSProperties = { padding: '0.5rem 1rem', flex: '1 1 auto', fontSize: '0.9rem' };
              
              if (isCurrentRealMonth && !isSelected) {
                style = { ...style, border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', fontWeight: 600 };
              }

              return (
                <button 
                  key={idx} 
                  onClick={() => setMonth(idx)}
                  className={`btn ${btnClass}`}
                  style={style}
                  title={isCurrentRealMonth ? 'Aktueller Monat' : undefined}
                >
                  {mName}
                </button>
              );
            })}
          </div>
          
          {/* Custom Balance Display */}
          <div className="glass glass-card flex flex-col justify-center gap-1 p-5 shadow-sm overflow-hidden relative mt-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-[100px] -z-10" />
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Überstunden (Gesamt)
            </div>
            <div className={`text-3xl font-bold ${totalOvertime > 0 ? 'text-green-600 dark:text-green-500' : totalOvertime < 0 ? 'text-red-600 dark:text-red-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
              {totalOvertime > 0 ? '+' : ''}{totalOvertime.toFixed(2)}h
            </div>
            {monthlyBalance?.transferred_hours !== 0 && (
               <div className="text-xs mt-1 text-zinc-500">
                 Inkl. Vormonat: <span className="font-semibold">{(totalOvertime + (monthlyBalance?.transferred_hours || 0)).toFixed(2)}h</span> (Übertrag: {monthlyBalance?.transferred_hours > 0 ? '+' : ''}{monthlyBalance?.transferred_hours || 0}h)
               </div>
            )}
          </div>

          <div className="hidden-desktop">
            <CustomSelect
              value={month.toString()}
              onChange={(val) => setMonth(Number(val))}
              options={monthNames.map((mName, idx) => {
                const isCurrentRealMonth = year === currentRealYear && idx === currentRealMonth;
                return { value: idx.toString(), label: `${mName} ${isCurrentRealMonth ? '(Aktuell)' : ''}` };
              })}
            />
          </div>
        </div>
      </div>

      {/* Timesheet Spreadsheet Table */}
      <div className="glass glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <table className="stundenzettel-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', width: '130px' }}>Datum</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Erfasste Zeiten</th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Pause</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Ist / Soll Std.</th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Differenz</th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Kürzel</th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'left', minWidth: '200px' }}>Notiz / Status</th>
              <th className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '60px' }}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ day, dayEntriesList, activeEntriesList, targetHours, actualHours, overtime, nightH, sundayH, holidayH, displayStatus, holidayName, startTime, endTime, totalBreak, isAbsence }, idx) => {
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const localDayStrFormatted = formatLocalDate(day);
              const localDayStr = `${weekdays[dayOfWeek]}. ${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}`;
              
              const sortedRaw = [...activeEntriesList].sort((a,b) => a.start_time.localeCompare(b.start_time));
              const nonDummyRaw = sortedRaw.filter(e => !(e.start_time === '00:00:00' && e.end_time === '00:00:00'));

              // Highlight style for weekends & holidays
              let rowBg = 'transparent';
              if (holidayName) {
                rowBg = 'rgba(14, 165, 233, 0.05)'; // light info blue
              } else if (isWeekend) {
                rowBg = 'rgba(255, 255, 255, 0.02)';
              }

              // Absence colors
              let statusColor = 'inherit';
              if (displayStatus.includes('Urlaub')) statusColor = 'var(--success)';
              if (displayStatus.includes('Krank')) statusColor = 'var(--danger)';
              
              const isCurrentUserOrAdmin = isAdmin || (dayEntriesList.length === 0) || dayEntriesList.every(e => e.user_id === currentUserId);
              
              const hasMultipleEntries = dayEntriesList.length > 1;
              const isExpanded = expandedDates.has(localDayStrFormatted);
              
              const isAllDeleted = dayEntriesList.length > 0 && dayEntriesList.every(e => !!e.deleted_at);

              return (
                <React.Fragment key={idx}>
                  <tr style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                    backgroundColor: rowBg,
                    fontSize: '0.9rem',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer',
                    color: isAllDeleted ? 'var(--text-secondary)' : 'inherit',
                    textDecoration: isAllDeleted ? 'line-through' : 'none',
                    fontStyle: isAllDeleted ? 'italic' : 'normal'
                  }}
                  className="timesheet-row"
                  onClick={() => toggleRow(localDayStrFormatted)}
                  >
                    {/* Date */}
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-primary)', minWidth: '16px' }}>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <div>
                          {localDayStr} {holidayName && <span style={{ fontSize: '0.7rem', color: 'var(--info)', display: 'block' }}>{holidayName}</span>}
                        </div>
                      </div>
                    </td>

                    {/* Icons (Zuschläge) */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {(nightH > 0 || sundayH > 0 || holidayH > 0) ? (
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          {nightH > 0 && <span title={`Nachtschicht`}>🌙</span>}
                          {(sundayH > 0 || holidayH > 0) && <span title={`Sonn-/Feiertag`}>🎉</span>}
                        </div>
                      ) : null}
                    </td>
                    
                    {/* Erfasste Zeiten */}
                    <td className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: isAbsence ? 'var(--text-secondary)' : 'inherit' }}>
                      {isAbsence ? '—' : (
                        nonDummyRaw.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                            {nonDummyRaw.map((e, i) => {
                              return (
                                <span key={i} style={{ whiteSpace: 'nowrap' }}>
                                  {e.start_time?.slice(0,5)} - {e.end_time ? e.end_time.slice(0,5) : 'Offen'}
                                </span>
                              );
                            })}
                          </div>
                        ) : '—'
                      )}
                    </td>
                    
                    {/* Break Minutes */}
                    <td className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {isAbsence || dayEntriesList.length === 0 ? '—' : `${totalBreak}m`}
                    </td>
                    
                    {/* Ist / Soll Hours */}
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600 }}>
                        {isAbsence ? '0.00' : (actualHours > 0 ? actualHours.toFixed(2) : '—')}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', margin: '0 0.25rem' }}>/</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {targetHours > 0 ? targetHours.toFixed(1) : '—'}
                      </span>
                    </td>
                    
                    {/* Overtime */}
                    <td className="hidden-mobile" style={{ 
                      padding: '0.75rem 0.5rem', 
                      textAlign: 'center', 
                      fontWeight: 600,
                      color: overtime > 0 ? 'var(--success)' : (overtime < 0 ? 'var(--danger)' : 'inherit')
                    }}>
                      {(isAbsence && targetHours === 0) ? '—' : (overtime !== 0 ? `${overtime > 0 ? '+' : ''}${overtime.toFixed(2)}` : '—')}
                    </td>

                    {/* Absence Code Selector */}
                    <td className="hidden-mobile" style={{ padding: '0.25rem 0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      {(absenceCodes && absenceCodes.length > 0 && isCurrentUserOrAdmin) ? (
                        <CustomSelect
                          value={dayEntriesList[0]?.absence_code || ''}
                          onChange={(val) => handleRowAbsenceCode(localDayStrFormatted, val)}
                          style={{ minWidth: '70px' }}
                          options={[
                            { value: '', label: '-' },
                            ...absenceCodes.map(code => ({ value: code.code, label: code.code }))
                          ]}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {dayEntriesList[0]?.absence_code || '—'}
                        </span>
                      )}
                    </td>

                    {/* Surcharges list removed from here */}

                    {/* Note / Status */}
                    <td className="hidden-mobile" style={{ padding: '0.75rem 0.5rem', color: statusColor, fontStyle: isAbsence ? 'italic' : 'normal', textAlign: 'left' }}>
                      {displayStatus || '—'}
                    </td>

                    {/* Actions */}
                    <td className="hidden-mobile" style={{ padding: '0.75rem 0.5rem' }} onClick={e => e.stopPropagation()}>
                      {isCurrentUserOrAdmin && (
                        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                          <button
                            onClick={() => openDayModal(day, dayEntriesList)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              transition: 'color 0.2s',
                            }}
                            title="Tages-Einträge bearbeiten"
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          >
                            <Edit3 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded View for Mobile */}
                  {isExpanded && (
                    <tr className="hidden-desktop" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', fontSize: '0.85rem' }}>
                      <td colSpan={9} style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          
                          <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>Zeiten:</span>
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                               {nonDummyRaw.length > 0 ? nonDummyRaw.map((e, i) => {
                                  return (
                                    <span key={i}>
                                      {e.start_time?.slice(0,5)} - {e.end_time ? e.end_time.slice(0,5) : 'Offen'}
                                    </span>
                                  );
                               }) : '—'}
                               <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({totalBreak}m Pause)</span>
                             </div>
                          </div>
                          
                          <div className="flex-between">
                             <span style={{ color: 'var(--text-secondary)' }}>Differenz:</span>
                             <span style={{ 
                                fontWeight: 600,
                                color: overtime > 0 ? 'var(--success)' : (overtime < 0 ? 'var(--danger)' : 'inherit')
                              }}>
                                {(isAbsence && targetHours === 0) ? '—' : (overtime !== 0 ? `${overtime > 0 ? '+' : ''}${overtime.toFixed(2)}` : '0.00')}
                             </span>
                          </div>

                          <div className="flex-between">
                             <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                             <span style={{ color: statusColor, textAlign: 'right' }}>{displayStatus || '—'}</span>
                          </div>

                          {(nightH > 0 || sundayH > 0 || holidayH > 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                               <div className="flex-between">
                                 <span style={{ color: 'var(--text-secondary)' }}>Zuschläge:</span>
                                 <span style={{ textAlign: 'right' }}>
                                   {nightH > 0 ? `${nightH}h 🌙 ` : ''}
                                   {(sundayH > 0 || holidayH > 0) ? `${(sundayH + holidayH).toFixed(2)}h 🎉` : ''}
                                 </span>
                               </div>
                               {dayEntriesList.map((entry, eIdx) => (
                                 <React.Fragment key={`mob-ext-${eIdx}`}>
                                   {entry.entry_nightH > 0 && entry.nightIntervals && entry.nightIntervals.map((inv: any, i: number) => (
                                     <div key={`m-n-${eIdx}-${i}`} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>
                                       ↳ {inv.text} Uhr ({inv.rawHours !== inv.effectiveHours ? `${inv.rawHours}h - Pause = ${inv.effectiveHours}h` : `${inv.effectiveHours}h`}) 🌙
                                     </div>
                                   ))}
                                   {(entry.entry_sundayH > 0 || entry.entry_holidayH > 0) && [
                                     ...(entry.sundayIntervals || []),
                                     ...(entry.holidayIntervals || [])
                                   ].map((inv: any, i: number) => (
                                     <div key={`m-h-${eIdx}-${i}`} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>
                                       ↳ {inv.text} Uhr ({inv.rawHours !== inv.effectiveHours ? `${inv.rawHours}h - Pause = ${inv.effectiveHours}h` : `${inv.effectiveHours}h`}) 🎉
                                     </div>
                                   ))}
                                 </React.Fragment>
                               ))}
                            </div>
                          )}

                          <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>Kürzel:</span>
                             <div onClick={e => e.stopPropagation()}>
                                {(absenceCodes && absenceCodes.length > 0 && isCurrentUserOrAdmin) ? (
                                  <CustomSelect
                                    value={dayEntriesList[0]?.absence_code || ''}
                                    onChange={(val) => handleRowAbsenceCode(localDayStrFormatted, val)}
                                    options={[
                                      { value: '', label: '-' },
                                      ...absenceCodes.map(code => ({ value: code.code, label: code.code }))
                                    ]}
                                    style={{ width: '120px' }}
                                  />
                                ) : (
                                  <span>{dayEntriesList[0]?.absence_code || '—'}</span>
                                )}
                             </div>
                          </div>
                          
                          {isCurrentUserOrAdmin && (
                             <button onClick={() => openDayModal(day, dayEntriesList)} className="btn btn-secondary glass" style={{ padding: '0.5rem', width: '100%', marginTop: '0.75rem', justifyContent: 'center' }}>
                               <Edit3 size={16} style={{ marginRight: '0.5rem' }} /> Tag bearbeiten
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* Expanded Sub-rows for Multiple Entries (Desktop only, as mobile handles it above) */}
                  {isExpanded && dayEntriesList.map((entry, subIdx) => {
                    const eNight = entry.entry_nightH || 0;
                    const eSun = entry.entry_sundayH || 0;
                    const eHol = entry.entry_holidayH || 0;
                    const eActual = entry.entry_actual_hours || 0;
                    const isSubAbsence = entry.absence_code === 'U' || entry.absence_code === 'K';
                    const hasIntervals = !isSubAbsence && (eNight > 0 || eSun > 0 || eHol > 0);
                    
                    let subStatus = '';
                    if (entry.absence_code === 'U') subStatus = '🏖️ Urlaub';
                    if (entry.absence_code === 'K') subStatus = '🤒 Krank';
                    if (entry.isSplitPart2) subStatus = '↳ Folgetag (Teil 2)';
                    if (entry.isSplitPart1) subStatus = 'Nachtschicht (Teil 1)';
                    const isDeleted = !!entry.deleted_at;
                    if (isDeleted) subStatus = 'Gelöscht';
                    const noteStr = entry.note && !entry.note.startsWith('Code: ') ? entry.note : '';
                    const parts = [subStatus, noteStr, entry.edit_reason ? `[Änderung: ${entry.edit_reason}]` : '', isDeleted && entry.delete_reason ? `[Grund: ${entry.delete_reason}]` : ''].filter(Boolean);
                    const finalStatus = parts.join(' | ');

                    return (
                      <tr key={`sub-${idx}-${subIdx}`} className="hidden-mobile" style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)', 
                        backgroundColor: 'rgba(0, 0, 0, 0.2)', // darker background for sub-rows
                        fontSize: '0.85rem',
                        color: isDeleted ? 'var(--text-secondary)' : 'inherit',
                        textDecoration: isDeleted ? 'line-through' : 'none',
                        fontStyle: isDeleted ? 'italic' : 'normal'
                      }}>
                        <td style={{ padding: '0.5rem 0.5rem 0.5rem 2.5rem', color: 'var(--text-secondary)' }}>
                          ↳ Eintrag {subIdx + 1}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {(eNight > 0 || eSun > 0 || eHol > 0) ? (
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                              {eNight > 0 && <span title={`Nachtschicht: ${eNight}h`}>🌙</span>}
                              {(eSun > 0 || eHol > 0) && <span title={`Sonn-/Feiertag: ${eSun + eHol}h`}>🎉</span>}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: isSubAbsence ? 'var(--text-secondary)' : 'inherit' }}>
                          {isSubAbsence ? '—' : (
                            entry.isSplitPart2 ? <span style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--info)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>◂ {entry.start_time?.slice(0,5)} bis {entry.end_time?.slice(0,5)}</span> :
                            entry.isSplitPart1 ? <span style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{entry.start_time?.slice(0,5)} bis {entry.end_time?.slice(0,5)} ▸</span> :
                            <span style={{ whiteSpace: 'nowrap' }}>{entry.start_time?.slice(0, 5)} - {entry.end_time ? entry.end_time.slice(0, 5) : 'Offen'}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {isSubAbsence ? '—' : `${entry.entry_break_minutes || 0}m`}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 500 }}>{isSubAbsence ? '0.00' : (eActual > 0 ? eActual.toFixed(2) : '—')}</span>
                          <span style={{ color: 'var(--text-secondary)', margin: '0 0.25rem' }}>/</span>
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>—</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {entry.absence_code || '—'}
                        </td>
                        {/* Surcharges list removed from here */}
                        <td style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontStyle: (isSubAbsence || isDeleted) ? 'italic' : 'normal' }}>
                          {finalStatus || '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}></td>
                      </tr>
                    );
                  })}

                  {/* Desktop Extended Info Rows for Intervals */}
                  {isExpanded && dayEntriesList.map((entry, subIdx) => {
                    const eNight = entry.entry_nightH || 0;
                    const eSun = entry.entry_sundayH || 0;
                    const eHol = entry.entry_holidayH || 0;
                    const isSubAbsence = entry.absence_code === 'U' || entry.absence_code === 'K';
                    if (isSubAbsence || (eNight === 0 && eSun === 0 && eHol === 0) || entry.isSplitPart2) return null;
                    
                    return (
                      <tr key={`ext-${idx}-${subIdx}`} className="hidden-mobile" style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)'
                      }}>
                        <td colSpan={8} style={{ padding: '0.5rem 0.5rem 0.5rem 2.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {eNight > 0 && entry.nightIntervals && entry.nightIntervals.map((inv: any, i: number) => (
                              <div key={`n-${i}`}>🌙 Nachtzuschlag von {inv.text} Uhr ({inv.rawHours !== inv.effectiveHours ? `${inv.rawHours} Std. abzgl. Pause = ${inv.effectiveHours} Std.` : `${inv.effectiveHours} Std.`})</div>
                            ))}
                            {(eSun > 0 || eHol > 0) && [
                              ...(entry.sundayIntervals || []),
                              ...(entry.holidayIntervals || [])
                            ].map((inv: any, i: number) => (
                              <div key={`h-${i}`}>🎉 Sonn-/Feiertagszuschlag von {inv.text} Uhr ({inv.rawHours !== inv.effectiveHours ? `${inv.rawHours} Std. abzgl. Pause = ${inv.effectiveHours} Std.` : `${inv.effectiveHours} Std.`})</div>
                            ))}
                          </div>
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Cards (Moved below table) */}
      <div className="glass glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
          Zusammenfassung für {monthNames[month]} {year}
        </h3>
        
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
            {currentMonthPayoutTotal > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                Davon ausgezahlt: {currentMonthPayoutTotal.toFixed(2)} Std.
              </div>
            )}
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

        {/* Abbreviations & Attendance Summary */}
        {(Object.keys(abbreviationCounts).length > 0 || attendanceDays > 0) && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem' }}>
              Übersicht der Kürzel
            </h4>
            <div className="grid-cols-4" style={{ gap: '1rem' }}>
              {Object.values(abbreviationCounts).map(abbr => (
                <div key={abbr.code} className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {abbr.name} ({abbr.code})
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {abbr.count.toFixed(1).replace('.', ',')}
                  </div>
                  {abbr.code === 'U' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                      Verfügbar: {remainingVacationDays} Tag(e)
                    </div>
                  )}
                </div>
              ))}
              {attendanceDays > 0 && (
                <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Anwesenheit
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {attendanceDays}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Day Edit Modal */}
      {editingDateStr && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Zeiten für den {editingDateStr}
                <button onClick={() => setEditingDateStr(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </h3>
            </div>
            
            {/* List existing entries */}
            {formMode === 'IDLE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                

                {dayEntries.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                    Keine Einträge an diesem Tag vorhanden.
                  </div>
                ) : (
                  dayEntries.filter(e => !(e.start_time === '00:00:00' && e.end_time === '00:00:00' && e.break_minutes === 0)).map(e => (
                    <div key={e.id} style={{ 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      border: '1px solid var(--glass-border)', 
                      borderRadius: '8px', 
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600 }}>
                          {`${e.start_time.slice(0,5)} - ${e.end_time ? e.end_time.slice(0,5) : 'Offen'} (Pause: ${e.break_minutes || 0}m)`}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {deleteConfirm === (e.original_id || e.id) ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="text" 
                                placeholder="Grund für Löschen (Pflichtfeld)" 
                                value={deleteReasonText} 
                                onChange={(evt) => setDeleteReasonText(evt.target.value)} 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)' }}
                              />
                              <button onClick={() => handleDelete(e.original_id || e.id)} style={{ background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>Löschen</button>
                              <button onClick={() => { setDeleteConfirm(null); setDeleteReasonText(''); }} style={{ background: 'var(--text-secondary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>X</button>
                            </div>
                          ) : (
                            <>
                              {!e.deleted_at && <button onClick={() => startEditEntry(e)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Bearbeiten</button>}
                              {!e.deleted_at && <button onClick={() => setDeleteConfirm(e.original_id || e.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Trash2 size={14}/></button>}
                            </>
                          )}
                        </div>
                      </div>
                      {(e.note || e.edit_reason || e.isSpillover || e.deleted_at) && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {e.isSpillover && <div style={{ color: 'var(--info)' }}>* Teil einer Schicht vom Vortag. (Bearbeitet die gesamte Schicht)</div>}
                          {e.note && <div>Notiz: {e.note}</div>}
                          {e.edit_reason && <div>Grund der Änderung: {e.edit_reason}</div>}
                          {e.deleted_at && <div style={{ color: 'var(--danger)' }}>Gelöscht am: {new Date(e.deleted_at).toLocaleString('de-DE')} | Grund: {e.delete_reason}</div>}
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                <button onClick={startNewEntry} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  ➕ Weiteren Eintrag hinzufügen
                </button>
              </div>
            )}

            {/* Form for EDIT / NEW */}
            {formMode !== 'IDLE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                <h4 style={{ margin: 0 }}>{formMode === 'NEW' ? 'Neuen Eintrag anlegen' : 'Eintrag bearbeiten'}</h4>
                
                {editError && (
                  <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.85rem', borderRadius: '4px' }}>
                    {editError}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Startzeit</label>
                    <input type="time" className="input-field" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Endzeit</label>
                    <input type="time" className="input-field" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Pause (Minuten)</label>
                  <input type="number" className="input-field" value={editBreakMinutes} onChange={e => setEditBreakMinutes(Number(e.target.value))} min={0} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Notiz</label>
                  <input type="text" className="input-field" value={editNote} onChange={e => setEditNote(e.target.value)} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--warning)', fontWeight: 600 }}>Grund für Änderung (Pflichtfeld)</label>
                  <input type="text" className="input-field" style={{ borderColor: 'var(--warning)' }} value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Z.B. Zeit nachgetragen..." required />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button onClick={() => setFormMode('IDLE')} className="btn btn-secondary glass" style={{ flex: 1 }}>Zurück</button>
                  <button onClick={handleSaveEdit} className="btn btn-primary" style={{ flex: 1 }}>Speichern</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
