"use client";

import React, { useState, useEffect } from 'react';
import { clockInAction, clockOutAction, recordBreakAction, setDayAbsenceCodeAction, createManualTimeEntryAction } from '@/app/actions';
import { Coffee, LogIn, LogOut, Calendar, Edit3, AlertCircle, Check } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface TimeTrackerCardProps {
  activeEntry: {
    id: string;
    entry_date: string;
    start_time: string;
    break_minutes: number;
    note: string | null;
  } | null;
  currentUserId: string;
  feature_urlaub?: boolean;
  feature_abwesenheit?: boolean;
}

export default function TimeTrackerCard({ activeEntry, currentUserId, feature_urlaub = false, feature_abwesenheit = false }: TimeTrackerCardProps) {
  const [note, setNote] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && activeEntry) {
      return !!sessionStorage.getItem('break_start_time');
    }
    return false;
  });
  const [breakElapsed, setBreakElapsed] = useState<string>('00:00');
  const [breakStartVal, setBreakStartVal] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && activeEntry) {
      const stored = sessionStorage.getItem('break_start_time');
      return stored ? Number(stored) : null;
    }
    return null;
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Absence Form State
  const [absenceDate, setAbsenceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [absenceCode, setAbsenceCode] = useState<'U' | 'K'>(() => feature_urlaub ? 'U' : 'K');
  const [absenceNote, setAbsenceNote] = useState<string>('');

  // Manual Entry Form State
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState<string>('08:00');
  const [manualEndTime, setManualEndTime] = useState<string>('16:30');
  const [manualBreak, setManualBreak] = useState<number>(30);

  // Timer for active work and active break
  useEffect(() => {
    if (!activeEntry) {
      setTimeout(() => setElapsedTime('00:00:00'), 0);
      return;
    }

    const timer = setInterval(() => {
      // Parse activeEntry start time
      const [sh, sm, ss] = activeEntry.start_time.split(':').map(Number);
      const startDate = new Date(activeEntry.entry_date);
      startDate.setHours(sh, sm, ss, 0);

      const now = new Date();
      
      // Calculate work duration
      let diffMs = now.getTime() - startDate.getTime();
      
      // Deduct recorded breaks
      const breakMs = (activeEntry.break_minutes || 0) * 60 * 1000;
      diffMs = Math.max(0, diffMs - breakMs);

      // Deduct current active break if any
      if (isOnBreak && breakStartVal) {
        const activeBreakMs = now.getTime() - breakStartVal;
        diffMs = Math.max(0, diffMs - activeBreakMs);

        // Update active break timer
        const breakSeconds = Math.floor(activeBreakMs / 1000);
        const bMin = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
        const bSec = String(breakSeconds % 60).padStart(2, '0');
        setBreakElapsed(`${bMin}:${bSec}`);
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
      const seconds = String(totalSeconds % 60).padStart(2, '0');

      setElapsedTime(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeEntry, isOnBreak, breakStartVal]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleClockIn = async () => {
    const res = await clockInAction(note);
    if (res.success) {
      showMsg('success', 'Einstempeln erfolgreich verbucht!');
      setNote('');
    } else {
      showMsg('error', res.message);
    }
  };

  const handleClockOut = async () => {
    // If on break, end break first
    if (isOnBreak) {
      await handleEndBreak();
    }
    const res = await clockOutAction(note);
    if (res.success) {
      showMsg('success', 'Ausstempeln erfolgreich verbucht!');
      setNote('');
    } else {
      showMsg('error', res.message);
    }
  };

  const handleStartBreak = () => {
    const startVal = Date.now();
    setIsOnBreak(true);
    setBreakStartVal(startVal);
    sessionStorage.setItem('break_start_time', String(startVal));
    showMsg('success', 'Pause gestartet. Erholung tut gut!');
  };

  const handleEndBreak = async () => {
    if (!breakStartVal) return;
    const endVal = Date.now();
    const elapsedMinutes = Math.max(1, Math.round((endVal - breakStartVal) / (1000 * 60)));

    setIsOnBreak(false);
    setBreakStartVal(null);
    sessionStorage.removeItem('break_start_time');

    const res = await recordBreakAction(elapsedMinutes);
    if (res.success) {
      showMsg('success', `Pause beendet: ${elapsedMinutes} Minuten wurden erfasst.`);
    } else {
      showMsg('error', res.message);
    }
  };

  const handleQuickBreak = async (minutes: number) => {
    const res = await recordBreakAction(minutes);
    if (res.success) {
      showMsg('success', `${minutes} Minuten Pause hinzugefügt.`);
    } else {
      showMsg('error', res.message);
    }
  };

  const handleAbsenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceDate) {
      showMsg('error', 'Bitte ein Datum auswählen.');
      return;
    }
    const res = await setDayAbsenceCodeAction(absenceDate, absenceCode, absenceNote);
    if (res.success) {
      const typeStr = absenceCode === 'U' ? 'Urlaub' : 'Krankheit';
      showMsg('success', `${typeStr} für den ${absenceDate} erfolgreich eingetragen.`);
      setAbsenceNote('');
    } else {
      showMsg('error', res.message);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createManualTimeEntryAction(currentUserId, manualDate, manualStartTime, manualEndTime, manualBreak, '', '');
    if (res.success) {
      showMsg('success', 'Nachträgliche Zeiterfassung erfolgreich eingetragen.');
    } else {
      showMsg('error', res.message);
    }
  };

  return (
    <div className="grid-cols-2" style={{ gap: '2rem', marginBottom: '2rem' }}>
      
      {/* Primary Clocking Card */}
      <div className="glass glass-card flex-center" style={{ flexDirection: 'column', gap: '1.5rem', minHeight: '350px', position: 'relative' }}>
        
        {/* Header and Status indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>Zeiterfassung</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: activeEntry ? (isOnBreak ? 'var(--warning)' : 'var(--success)') : 'var(--text-secondary)',
              boxShadow: activeEntry ? `0 0 10px ${isOnBreak ? 'var(--warning)' : 'var(--success)'}` : 'none'
            }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {activeEntry ? (isOnBreak ? 'In Pause' : 'Aktiv eingestempelt') : 'Nicht eingestempelt'}
            </span>
          </div>
        </div>

        {/* Live Timer Display */}
        <div className="flex-center" style={{ flexDirection: 'column', margin: '1rem 0' }}>
          <span style={{ fontSize: '3rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {elapsedTime}
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {activeEntry ? `Heute gestartet um ${activeEntry.start_time.slice(0,5)} Uhr` : 'Bereit zum Einstempeln'}
          </span>
        </div>

        {/* Action Message Alert */}
        {message && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            width: '100%',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Note input field */}
        <div style={{ width: '100%' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
            Tätigkeitsnotiz (optional)
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder={activeEntry ? "Was tun Sie gerade?" : "Notiz für heutigen Eintrag..."}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
            <Edit3 size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Buttons Grid */}
        <div style={{ display: 'flex', width: '100%', gap: '1rem', marginTop: 'auto' }}>
          {!activeEntry ? (
            <button onClick={handleClockIn} className="btn btn-primary" style={{ flex: 1, height: '48px' }}>
              <LogIn size={18} /> Einstempeln
            </button>
          ) : (
            <>
              {isOnBreak ? (
                <button onClick={handleEndBreak} className="btn btn-secondary glass" style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)', height: '48px' }}>
                  <Coffee size={18} /> Pause beenden ({breakElapsed})
                </button>
              ) : (
                <button onClick={handleStartBreak} className="btn btn-secondary glass" style={{ flex: 1, height: '48px' }}>
                  <Coffee size={18} /> Pause starten
                </button>
              )}
              <button onClick={handleClockOut} className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)', boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.39)', height: '48px' }}>
                <LogOut size={18} /> Ausstempeln
              </button>
            </>
          )}
        </div>

        {/* Quick Break Buttons (when clocked in and not on active break) */}
        {activeEntry && !isOnBreak && (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem', marginTop: '-0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>Schnell-Pause:</span>
            <button onClick={() => handleQuickBreak(15)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+15m</button>
            <button onClick={() => handleQuickBreak(30)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+30m</button>
            <button onClick={() => handleQuickBreak(45)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+45m</button>
          </div>
        )}
      </div>

      {/* Secondary Absence Booking Card */}
      {(feature_urlaub || feature_abwesenheit) && (
        <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '350px' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={22} className="text-gradient" /> Abwesenheit buchen
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Erfassen Sie einen ganztägigen Urlaub oder einen Krankheitstag. Ein bestehender Zeiteintrag an diesem Tag wird überschrieben.
        </p>

        <form onSubmit={handleAbsenceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
          
          <div className="grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Datum
              </label>
              <input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Typ
              </label>
              <CustomSelect
                value={absenceCode}
                onChange={(val) => setAbsenceCode(val as 'U' | 'K')}
                options={[
                  ...(feature_urlaub ? [{ value: 'U', label: '🏖️ Urlaub (U)' }] : []),
                  ...(feature_abwesenheit ? [{ value: 'K', label: '🤒 Krank (K)' }] : [])
                ]}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
              Bemerkung / Begründung
            </label>
            <input
              type="text"
              placeholder={absenceCode === 'U' ? 'Erholungsurlaub' : 'Arbeitsunfähigkeitsbescheinigung vorliegend'}
              value={absenceNote}
              onChange={(e) => setAbsenceNote(e.target.value)}
              className="input-field"
            />
          </div>

          <button type="submit" className="btn btn-secondary glass" style={{ marginTop: 'auto', width: '100%', height: '48px', fontWeight: 600 }}>
            Eintragen
          </button>
        </form>
      </div>
      )}

      {/* Manual Entry Card (Forgot to clock in) */}
      <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Edit3 size={20} className="text-gradient" /> Vergessen zu stempeln?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '-0.5rem' }}>
          Tragen Sie hier eine vergangene Schicht nach, falls Sie vergessen haben zu stempeln.
        </p>

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Datum</label>
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Pause (Min)</label>
              <input type="number" value={manualBreak} onChange={(e) => setManualBreak(Number(e.target.value))} className="input-field" min="0" required />
            </div>
          </div>
          <div className="grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Startzeit</label>
              <input type="time" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Endzeit</label>
              <input type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} className="input-field" required />
            </div>
          </div>

          <button type="submit" className="btn btn-secondary glass" style={{ marginTop: '0.5rem', width: '100%', height: '48px', fontWeight: 600 }}>
            Nachtragen
          </button>
        </form>
      </div>

    </div>
  );
}
