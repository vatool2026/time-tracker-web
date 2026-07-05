"use client";

import React, { useState } from 'react';
import { updateEmployeeSettingsAction, deleteCompanyUserAction } from '@/app/actions';
import { X, Save, AlertCircle, Check, Trash2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  email: string;
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE';
  employment_category: 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  is_minor?: boolean;
  start_date?: string | null;
}

interface EmployeeSettings {
  target_hours_monday: number;
  target_hours_tuesday: number;
  target_hours_wednesday: number;
  target_hours_thursday: number;
  target_hours_friday: number;
  target_hours_saturday: number;
  target_hours_sunday: number;
  vacation_days_entitlement: number;
  carry_over_hours: number;
  carry_over_vacation_days: number;
}

interface EmployeeSettingsModalProps {
  employee: EmployeeProfile;
  settings: EmployeeSettings | null;
  onClose: () => void;
  feature_urlaub?: boolean;
}

export default function EmployeeSettingsModal({
  employee,
  settings,
  onClose,
  feature_urlaub = false
}: EmployeeSettingsModalProps) {
  const [role, setRole] = useState<'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE'>(employee.role);
  const [category, setCategory] = useState<'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER'>(employee.employment_category);
  const [isMinor, setIsMinor] = useState<boolean>(employee.is_minor || false);
  const [employeeNumber, setEmployeeNumber] = useState<string>(employee.employee_number || '');
  const [startDate, setStartDate] = useState<string>(employee.start_date || '');
  const [carryOverHours, setCarryOverHours] = useState<number>(settings?.carry_over_hours || 0);
  const [vacationEntitlement, setVacationEntitlement] = useState<number>(settings?.vacation_days_entitlement || 30);
  const [carryOverVacation, setCarryOverVacation] = useState<number>(settings?.carry_over_vacation_days || 0);
  const [carryOverYear, setCarryOverYear] = useState<number>(new Date().getFullYear() - 1);

  // Daily target hours
  const [mon, setMon] = useState<number>(settings?.target_hours_monday ?? 8);
  const [tue, setTue] = useState<number>(settings?.target_hours_tuesday ?? 8);
  const [wed, setWed] = useState<number>(settings?.target_hours_wednesday ?? 8);
  const [thu, setThu] = useState<number>(settings?.target_hours_thursday ?? 8);
  const [fri, setFri] = useState<number>(settings?.target_hours_friday ?? 8);
  const [sat, setSat] = useState<number>(settings?.target_hours_saturday ?? 0);
  const [sun, setSun] = useState<number>(settings?.target_hours_sunday ?? 0);

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const targets = {
      monday: Number(mon),
      tuesday: Number(tue),
      wednesday: Number(wed),
      thursday: Number(thu),
      friday: Number(fri),
      saturday: Number(sat),
      sunday: Number(sun)
    };

    const res = await updateEmployeeSettingsAction(
      employee.id,
      role,
      category,
      Number(carryOverHours),
      Number(vacationEntitlement),
      Number(carryOverVacation),
      targets,
      employeeNumber || null,
      isMinor,
      startDate || null,
      Number(carryOverYear)
    );

    setLoading(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'Mitarbeiter-Einstellungen erfolgreich gespeichert!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Möchten Sie diesen Benutzer wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    setLoading(true);
    setMessage(null);
    
    const res = await deleteCompanyUserAction(employee.id);
    
    setLoading(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'Benutzer wurde erfolgreich gelöscht.' });
      setTimeout(() => {
        onClose();
        if (typeof window !== 'undefined') window.location.reload();
      }, 1500);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      
      {/* Modal Card */}
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        padding: '2rem',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--glass-border)'
      }}>
        
        {/* Header */}
        <div className="flex-between" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>Mitarbeiter konfigurieren</h3>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {employee.first_name} {employee.last_name} ({employee.email})
            </span>
          </div>
          <button 
            onClick={onClose} 
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            aria-label="Schließen"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section: Profile settings */}
          <div className="grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Rolle</label>
              <CustomSelect
                value={role}
                onChange={(val) => setRole(val as 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE')}
                options={[
                  { value: 'EMPLOYEE', label: 'Mitarbeiter' },
                  { value: 'COMPANY_ADMIN', label: 'Firmen-Admin' },
                  { value: 'ROOT', label: 'Root (System-Admin)' }
                ]}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Anstellungskategorie</label>
              <CustomSelect
                value={category}
                onChange={(val) => setCategory(val as 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER')}
                options={[
                  { value: 'AZUBI', label: 'Azubi' },
                  { value: 'MIDIJOB', label: 'Midi Job' },
                  { value: 'MINIJOB', label: 'Mini Job' },
                  { value: 'OTHER', label: 'Sonstige' },
                  { value: 'PARTTIME', label: 'Teilzeit' },
                  { value: 'FULLTIME', label: 'Vollzeit' }
                ]}
              />
            </div>
          </div>

          {category === 'AZUBI' && (
            <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.05)', padding: '1rem', borderLeft: '3px solid var(--accent-secondary)', borderRadius: 'var(--border-radius-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={isMinor} 
                  onChange={(e) => setIsMinor(e.target.checked)} 
                  style={{ transform: 'scale(1.2)' }}
                />
                <span>
                  <strong>Minderjährig (unter 18 Jahre)</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Falls aktiv, wird in der Arbeitszeitschutz-Auswertung das Jugendarbeitsschutzgesetz (strengere Pausenregeln) angewendet.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="grid-cols-2" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Mitarbeiternummer
              </label>
              <input
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="input-field"
                placeholder="Optional"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Eintrittsdatum
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Section: Hours & Vacation balances */}
          <div className="grid-cols-2 md:grid-cols-4" style={{ gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Übertragsjahr
              </label>
              <input
                type="number"
                value={carryOverYear}
                onChange={(e) => setCarryOverYear(Number(e.target.value))}
                className="input-field"
                min="2010"
                max="2100"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Überstunden Übertrag (Std.)
              </label>
              <input
                type="number"
                step="0.1"
                value={carryOverHours}
                onChange={(e) => setCarryOverHours(Number(e.target.value))}
                className="input-field"
              />
            </div>
            
            {feature_urlaub && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Urlaubsanspruch (Tage)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={vacationEntitlement}
                    onChange={(e) => setVacationEntitlement(Number(e.target.value))}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Resturlaub Übertrag (Tage)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={carryOverVacation}
                    onChange={(e) => setCarryOverVacation(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
              </>
            )}
          </div>

          {/* Section: Daily target hours (Soll-Stunden) */}
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Soll-Stunden pro Wochentag</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
              {[
                { label: 'Mo', val: mon, set: setMon },
                { label: 'Di', val: tue, set: setTue },
                { label: 'Mi', val: wed, set: setWed },
                { label: 'Do', val: thu, set: setThu },
                { label: 'Fr', val: fri, set: setFri },
                { label: 'Sa', val: sat, set: setSat },
                { label: 'So', val: sun, set: setSun }
              ].map(({ label, val, set }, idx) => (
                <div key={idx} style={{ textAlign: 'center' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="input-field"
                    style={{ padding: '0.5rem 0.25rem', textAlign: 'center', fontSize: '0.9rem' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className="glass" style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--border-radius-sm)',
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

          {/* Footer Actions */}
          <div className="flex-between" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem', gap: '1rem', display: 'flex' }}>
            <button 
              type="button" 
              onClick={handleDelete} 
              className="btn btn-secondary glass" 
              disabled={loading || role === 'ROOT'} 
              style={{ color: role === 'ROOT' ? 'inherit' : 'var(--danger)', borderColor: role === 'ROOT' ? 'inherit' : 'var(--danger)' }}
            >
              <Trash2 size={18} /> Benutzer löschen
            </button>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary glass" disabled={loading}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '130px' }}>
                {loading ? 'Wird gespeichert...' : <><Save size={18} /> Speichern</>}
              </button>
            </div>
          </div>

        </form>

      </div>

    </div>
  );
}
