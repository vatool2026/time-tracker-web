"use client";

import React, { useState } from 'react';
import { updateCarryOverAction } from '@/app/actions';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employment_category: string;
  last_login?: string | null;
}

interface TimesheetSettings {
  user_id?: string;
  carry_over_hours: number;
  carry_over_vacation_days: number;
}

interface CarryoverAdminTabProps {
  employees: Profile[] | null;
  allTimesheetSettings: TimesheetSettings[] | null;
  feature_urlaub?: boolean;
}

export default function CarryoverAdminTab({ employees, allTimesheetSettings, feature_urlaub }: CarryoverAdminTabProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loadingIds, setLoadingIds] = useState<string[]>([]);

  // State to hold local edits before saving
  const [edits, setEdits] = useState<Record<string, { hours: number; vacation: number }>>(() => {
    const initial: Record<string, { hours: number; vacation: number }> = {};
    if (employees && allTimesheetSettings) {
      employees.forEach(emp => {
        const setting = allTimesheetSettings.find(s => s.user_id === emp.id);
        initial[emp.id] = {
          hours: setting?.carry_over_hours || 0,
          vacation: setting?.carry_over_vacation_days || 0
        };
      });
    }
    return initial;
  });

  if (!employees) return null;

  const handleSave = async (empId: string) => {
    setLoadingIds(prev => [...prev, empId]);
    const val = edits[empId] || { hours: 0, vacation: 0 };
    
    const res = await updateCarryOverAction(empId, val.hours, val.vacation);
    
    setLoadingIds(prev => prev.filter(id => id !== empId));
    
    if (res.success) {
      setMessage({ type: 'success', text: 'Übertrag gespeichert.' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const handleChange = (empId: string, field: 'hours' | 'vacation', value: string) => {
    const parsed = value === '' ? 0 : parseFloat(value);
    setEdits(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: isNaN(parsed) ? 0 : parsed
      }
    }));
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Start-Überträge (Vorjahr)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Tragen Sie hier die anfänglichen Überstunden und Resturlaubstage für das aktuelle Jahr (z.B. aus 2025) ein.
        </p>
      </div>

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
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Mitarbeiter</th>
              <th style={{ padding: '0.75rem 0.5rem' }}>Überstunden (Std.)</th>
              {feature_urlaub && <th style={{ padding: '0.75rem 0.5rem' }}>Resturlaub (Tage)</th>}
              <th style={{ padding: '0.75rem 0.5rem', width: '120px' }}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                  {emp.first_name} {emp.last_name}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{emp.email}</div>
                </td>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <input
                    type="number"
                    step="0.5"
                    value={edits[emp.id]?.hours ?? 0}
                    onChange={(e) => handleChange(emp.id, 'hours', e.target.value)}
                    className="input-field"
                    style={{ width: '100px', padding: '0.4rem 0.6rem' }}
                  />
                </td>
                {feature_urlaub && (
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <input
                      type="number"
                      step="0.5"
                      value={edits[emp.id]?.vacation ?? 0}
                      onChange={(e) => handleChange(emp.id, 'vacation', e.target.value)}
                      className="input-field"
                      style={{ width: '100px', padding: '0.4rem 0.6rem' }}
                    />
                  </td>
                )}
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <button
                    onClick={() => handleSave(emp.id)}
                    className="btn btn-primary"
                    disabled={loadingIds.includes(emp.id)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    {loadingIds.includes(emp.id) ? 'Speichert...' : 'Speichern'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
