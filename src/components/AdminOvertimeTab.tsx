"use client";

import React, { useState } from 'react';
import { saveOvertimePayoutAction, deleteOvertimePayoutAction } from '@/app/actions';
import { CheckCircle, AlertCircle, Search, Save, Trash2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
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

interface AdminOvertimeTabProps {
  employees: Profile[];
  allCompanyPayouts: OvertimePayout[];
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export default function AdminOvertimeTab({
  employees,
  allCompanyPayouts,
}: AdminOvertimeTabProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [hours, setHours] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      showMsg('error', 'Bitte wählen Sie einen Mitarbeiter aus.');
      return;
    }
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) {
      showMsg('error', 'Bitte geben Sie einen gültigen Stundenwert ein.');
      return;
    }

    setLoading(true);
    const res = await saveOvertimePayoutAction(selectedUserId, selectedYear, selectedMonth, numHours, note);
    setLoading(false);

    if (res.success) {
      showMsg('success', res.message);
      setHours('');
      setNote('');
    } else {
      showMsg('error', res.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;
    setLoading(true);
    const res = await deleteOvertimePayoutAction(id);
    setLoading(false);
    if (res.success) {
      showMsg('success', res.message);
    } else {
      showMsg('error', res.message);
    }
  };

  const employeeOptions = employees.map(emp => ({
    value: emp.id,
    label: `${emp.first_name} ${emp.last_name}`
  }));

  const monthOptions = MONTHS.map((m, i) => ({
    value: (i + 1).toString(),
    label: m
  }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: (new Date().getFullYear() - 2 + i).toString(),
    label: (new Date().getFullYear() - 2 + i).toString()
  }));

  const filteredPayouts = allCompanyPayouts
    .filter(p => !selectedUserId || p.user_id === selectedUserId)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  return (
    <div className="glass glass-card" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Überstunden auszahlen</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tragen Sie hier ein, wenn einem Mitarbeiter Überstunden finanziell vergütet (ausgezahlt) wurden. 
          Diese Stunden werden automatisch vom Überstundenkonto des Mitarbeiters abgezogen.
        </p>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        alignItems: 'end',
        padding: '1.5rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--border-radius-md)',
        border: '1px solid var(--glass-border)'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Mitarbeiter
          </label>
          <CustomSelect
            options={employeeOptions}
            value={selectedUserId}
            onChange={setSelectedUserId}
            placeholder="Mitarbeiter wählen..."
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Jahr
          </label>
          <CustomSelect
            options={yearOptions}
            value={selectedYear.toString()}
            onChange={(v) => setSelectedYear(parseInt(v))}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Monat
          </label>
          <CustomSelect
            options={monthOptions}
            value={selectedMonth.toString()}
            onChange={(v) => setSelectedMonth(parseInt(v))}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Anzahl Stunden
          </label>
          <input 
            type="number" 
            step="0.01" 
            min="0"
            className="input-field" 
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="z.B. 10.5" 
            required 
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Notiz (optional)
          </label>
          <input 
            type="text" 
            className="input-field" 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Grund / Anmerkung" 
          />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} />
            {loading ? 'Wird gespeichert...' : 'Auszahlung speichern'}
          </button>
        </div>
      </form>

      <div style={{ marginTop: '3rem' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Historie Auszahlungen</h4>
        
        {filteredPayouts.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem' }}>Monat/Jahr</th>
                  <th style={{ padding: '0.75rem' }}>Mitarbeiter</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Stunden</th>
                  <th style={{ padding: '0.75rem' }}>Notiz</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map(p => {
                  const emp = employees.find(e => e.id === p.user_id);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>{MONTHS[p.month - 1]} {p.year}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 500 }}>{emp ? `${emp.first_name} ${emp.last_name}` : 'Unbekannt'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary-color)' }}>{p.hours.toFixed(2)}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{p.note || '-'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)' }}>
            Es liegen keine Auszahlungen für den gewählten Mitarbeiter vor.
          </div>
        )}
      </div>
    </div>
  );
}
