"use client";

import React, { useState, useEffect } from 'react';
import { Play, Square, Coffee, Edit3, LogIn, LogOut, AlertCircle, Check, ChevronDown, ChevronUp, QrCode } from 'lucide-react';
import { clockInAction, clockOutAction, recordBreakAction, createManualTimeEntryAction } from '@/app/actions';
import { addOfflineAction } from '@/utils/offlineQueue';
import QRScannerModal from './QRScannerModal';
import FaviconManager, { FaviconState } from './FaviconManager';

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
  feature_qr_tracking?: boolean;
  qrCodes?: any[] | null;
  companyLat?: number | null;
  companyLng?: number | null;
  geofenceRadius?: number;
  companyAddressStreet?: string | null;
  companyAddressCity?: string | null;
}

export default function TimeTrackerCard({ 
  activeEntry, currentUserId, feature_urlaub = false, feature_abwesenheit = false, feature_qr_tracking = false, qrCodes = [],
  companyLat, companyLng, geofenceRadius = 150, companyAddressStreet, companyAddressCity
}: TimeTrackerCardProps) {
  const [optimisticActiveEntry, setOptimisticActiveEntry] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('optimistic_active_entry');
      if (activeEntry) {
        if (stored) {
          localStorage.removeItem('optimistic_active_entry');
          setOptimisticActiveEntry(null);
        }
      } else if (stored) {
        setOptimisticActiveEntry(JSON.parse(stored));
      }
    }
  }, [activeEntry]);

  const displayEntry = optimisticActiveEntry || activeEntry;
  const isOfflineEntry = !!optimisticActiveEntry && !activeEntry;

  const [note, setNote] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && (activeEntry || localStorage.getItem('optimistic_active_entry'))) {
      return !!sessionStorage.getItem('break_start_time');
    }
    return false;
  });
  const [breakElapsed, setBreakElapsed] = useState<string>('00:00');
  const [breakStartVal, setBreakStartVal] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && (activeEntry || localStorage.getItem('optimistic_active_entry'))) {
      const stored = sessionStorage.getItem('break_start_time');
      return stored ? Number(stored) : null;
    }
    return null;
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [breakWarning, setBreakWarning] = useState<string | null>(null);
  
  const [qrMenuOpen, setQrMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [geofencePrompt, setGeofencePrompt] = useState<boolean>(false);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  
  // Manual Entry Form State
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState<string>('08:00');
  const [manualEndTime, setManualEndTime] = useState<string>('16:30');
  const [manualBreak, setManualBreak] = useState<number>(30);

  const [faviconState, setFaviconState] = useState<FaviconState>('default');

  // Geofencing Logic
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation || !companyLat || !companyLng) return;
    
    // If already clocked in, no need to prompt
    if (displayEntry) {
      setGeofencePrompt(false);
      return;
    }

    const deg2rad = (deg: number) => deg * (Math.PI/180);
    const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3; // Radius of the earth in m
      const dLat = deg2rad(lat2-lat1);
      const dLon = deg2rad(lon2-lon1); 
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c; // Distance in m
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const dist = getDistanceFromLatLonInM(
          position.coords.latitude,
          position.coords.longitude,
          companyLat,
          companyLng
        );
        if (dist <= geofenceRadius) {
          setGeofencePrompt(true);
        } else {
          setGeofencePrompt(false);
        }
        setGeofenceError(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGeofenceError('Standortzugriff verweigert. Automatischer Einstempel-Hinweis ist deaktiviert.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [displayEntry, companyLat, companyLng, geofenceRadius]);

  // Timer for active work and active break
  useEffect(() => {
    if (!displayEntry) {
      setTimeout(() => setElapsedTime('00:00:00'), 0);
      return;
    }

    const timer = setInterval(() => {
      // Parse activeEntry start time
      const [sh, sm, ss] = displayEntry.start_time.split(':').map(Number);
      const startDate = new Date(displayEntry.entry_date);
      startDate.setHours(sh, sm, ss, 0);

      const now = new Date();
      
      // Calculate work duration
      let diffMs = now.getTime() - startDate.getTime();
      
      // Deduct recorded breaks
      const breakMs = (displayEntry.break_minutes || 0) * 60 * 1000;
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

      // Check ArbZG break requirements
      const totalBreakMinutes = (displayEntry.break_minutes || 0) + (isOnBreak && breakStartVal ? Math.floor((now.getTime() - breakStartVal) / 60000) : 0);
      
      if (totalSeconds >= 9 * 3600 && totalBreakMinutes < 45) {
        setBreakWarning('Achtung: Bei über 9 Std. Arbeitszeit sind gesetzlich mind. 45 Min. Pause vorgeschrieben.');
        setFaviconState('violation');
      } else if (totalSeconds >= 8.75 * 3600 && totalBreakMinutes < 45) {
        setBreakWarning('Hinweis: Nach 9 Std. Arbeitszeit sind gesetzlich mind. 45 Min. Pause vorgeschrieben.');
        setFaviconState('warning');
      } else if (totalSeconds >= 6 * 3600 && totalBreakMinutes < 30) {
        setBreakWarning('Achtung: Nach 6 Std. Arbeitszeit sind gesetzlich mind. 30 Min. Pause vorgeschrieben.');
        setFaviconState('violation');
      } else if (totalSeconds >= 5.75 * 3600 && totalBreakMinutes < 30) {
        setBreakWarning('Hinweis: Sie arbeiten bald 6 Stunden. Bitte denken Sie an die gesetzliche Pause (30 Min).');
        setFaviconState('warning');
      } else {
        setBreakWarning(null);
        setFaviconState('active');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [displayEntry, isOnBreak, breakStartVal]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleClockIn = async () => {
    if (!navigator.onLine) {
      const offlineAction = await addOfflineAction('clockInAction', { note, qr_code_id: null });
      
      // Optimistic UI updates
      const now = new Date();
      const newEntry = {
        id: 'optimistic-' + Date.now(),
        entry_date: now.toISOString().split('T')[0],
        start_time: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        break_minutes: 0,
        note: note
      };
      setOptimisticActiveEntry(newEntry);
      localStorage.setItem('optimistic_active_entry', JSON.stringify(newEntry));
      setFaviconState('active');

      showMsg('success', 'Offline gespeichert. Wird synchronisiert, sobald wieder Empfang besteht.');
      setNote('');
      return;
    }
    const res = await clockInAction(note);
    if (res.success) {
      showMsg('success', 'Einstempeln erfolgreich verbucht!');
      setNote('');
      setFaviconState('active');

      // Request Notification Permission and show local notification (Variante A)
      if ('Notification' in window && 'serviceWorker' in navigator) {
        Notification.requestPermission().then(async (permission) => {
          if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            
            const now = new Date();
            const startStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            
            const breakTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
            const breakStr = breakTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            registration.showNotification('Zeiterfassung gestartet', {
              body: `Gestartet um ${startStr} Uhr. Spätestens um ${breakStr} Uhr eine Pause von 30 Minuten machen!`,
              icon: '/icons/icon-active.svg',
              badge: '/icons/icon-active.svg',
              tag: 'tracking-start',
              requireInteraction: true // Make it persistent until dismissed
            });

            // Subscribe to Web Push (Variante B)
            try {
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
              });

              await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
              });
            } catch (err) {
              console.error('Failed to subscribe to web push:', err);
            }
          }
        });
      }
      
      // Set App Badge
      if ('setAppBadge' in navigator) {
        (navigator as any).setAppBadge(1).catch(() => {});
      }
    } else {
      showMsg('error', res.message);
    }
  };

  const handleClockOut = async () => {
    // If on break, end break first
    if (isOnBreak) {
      await handleEndBreak();
    }
    if (!navigator.onLine) {
      await addOfflineAction('clockOutAction', { note });
      
      // Optimistic UI updates
      setOptimisticActiveEntry(null);
      localStorage.removeItem('optimistic_active_entry');
      setFaviconState('default');

      showMsg('success', 'Offline gespeichert. Wird synchronisiert, sobald wieder Empfang besteht.');
      setNote('');
      return;
    }
    const res = await clockOutAction(note);
    if (res.success) {
      showMsg('success', 'Ausstempeln erfolgreich verbucht!');
      setNote('');
      setFaviconState('default');
      
      // Clear App Badge
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
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

    const startIso = new Date(breakStartVal).toISOString();
    const endIso = new Date(endVal).toISOString();

    setIsOnBreak(false);
    setBreakStartVal(null);
    sessionStorage.removeItem('break_start_time');

    if (!navigator.onLine) {
      await addOfflineAction('recordBreakAction', { minutes: elapsedMinutes, startIso, endIso });
      showMsg('success', 'Pause beendet (Offline gespeichert).');
      return;
    }

    const res = await recordBreakAction(elapsedMinutes, startIso, endIso);
    if (res.success) {
      showMsg('success', `Pause beendet: ${elapsedMinutes} Minuten wurden erfasst.`);
    } else {
      showMsg('error', res.message);
    }
  };

  const handleQuickBreak = async (minutes: number) => {
    if (!navigator.onLine) {
      await addOfflineAction('recordBreakAction', { minutes });
      showMsg('success', `${minutes} Minuten Pause hinzugefügt (Offline gespeichert).`);
      return;
    }
    const res = await recordBreakAction(minutes);
    if (res.success) {
      showMsg('success', `${minutes} Minuten Pause hinzugefügt.`);
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
      <FaviconManager state={!displayEntry ? 'default' : faviconState} />
      
      {/* Primary Clocking Card */}
      <div className="glass glass-card flex-center" style={{ flexDirection: 'column', gap: '1.5rem', minHeight: '350px', position: 'relative' }}>
        
        {/* Header and Status indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Zeiterfassung
            {isOfflineEntry && (
              <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--warning)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                Offline gespeichert
              </span>
            )}
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: displayEntry ? (isOnBreak ? 'var(--warning)' : 'var(--success)') : 'var(--text-secondary)',
              boxShadow: displayEntry ? `0 0 10px ${isOnBreak ? 'var(--warning)' : 'var(--success)'}` : 'none'
            }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {displayEntry ? (isOnBreak ? 'In Pause' : 'Aktiv eingestempelt') : 'Nicht eingestempelt'}
            </span>
          </div>
        </div>

        {/* Live Timer Display */}
        <div className="flex-center" style={{ flexDirection: 'column', margin: '1rem 0' }}>
          <span style={{ fontSize: '3rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
            {elapsedTime}
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {displayEntry ? `Heute gestartet um ${displayEntry.start_time.slice(0,5)} Uhr` : 'Bereit zum Einstempeln'}
          </span>
        </div>

        {/* Break Warning Message */}
        {breakWarning && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            width: '100%',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{breakWarning}</span>
          </div>
        )}

        {/* Geofence Prompt */}
        {geofencePrompt && !displayEntry && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            width: '100%',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            animation: 'pulse 2s infinite'
          }}>
            <LogIn size={18} style={{ flexShrink: 0 }} />
            <span>Sie sind am Firmenstandort angekommen! Vergessen Sie nicht einzustempeln.</span>
          </div>
        )}

        {/* Geofence Error Message */}
        {geofenceError && !displayEntry && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            width: '100%',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{geofenceError}</span>
          </div>
        )}

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
              placeholder={displayEntry ? "Was tun Sie gerade?" : "Notiz für heutigen Eintrag..."}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.5rem' }}
            />
            <Edit3 size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {/* Buttons Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem', marginTop: 'auto' }}>
          {!displayEntry ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button onClick={handleClockIn} className="btn btn-primary" style={{ flex: 1, height: '48px' }}>
                  <LogIn size={18} /> Einstempeln
                </button>
                {feature_qr_tracking && isMobile && (
                  <button onClick={() => setIsScannerOpen(true)} className="btn btn-secondary glass" style={{ width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <QrCode size={20} />
                  </button>
                )}
              </div>
              
              {feature_qr_tracking && qrCodes && qrCodes.filter(q => q.is_active).length > 0 && (
                <div style={{ width: '100%' }}>
                  <button 
                    onClick={() => setQrMenuOpen(!qrMenuOpen)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.25rem 0', cursor: 'pointer' }}
                  >
                    Schnellauswahl QR-Codes {qrMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {qrMenuOpen && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {qrCodes.filter(q => q.is_active).map(qr => (
                        <button 
                          key={qr.id}
                          onClick={() => setNote(qr.note_text)}
                          className="btn-secondary glass"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
                        >
                          {qr.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
        {displayEntry && !isOnBreak && (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem', marginTop: '-0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>Schnell-Pause:</span>
            <button onClick={() => handleQuickBreak(15)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+15m</button>
            <button onClick={() => handleQuickBreak(30)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+30m</button>
            <button onClick={() => handleQuickBreak(45)} className="btn btn-secondary glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>+45m</button>
          </div>
        )}
      </div>

      {isScannerOpen && (
        <QRScannerModal onClose={() => setIsScannerOpen(false)} />
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
