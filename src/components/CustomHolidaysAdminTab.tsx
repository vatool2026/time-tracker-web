"use client";

import React, { useState } from 'react';
import { updateCompanyHolidaysAction } from '@/app/actions';
import { PlusCircle, Trash2, Save, Calendar } from 'lucide-react';

interface CustomHoliday {
  id: string;
  company_id: string;
  name: string;
  date: string; // YYYY-MM-DD
}

interface CustomHolidaysAdminTabProps {
  companyId: string;
  initialHolidays: CustomHoliday[];
}

export default function CustomHolidaysAdminTab({ companyId, initialHolidays }: CustomHolidaysAdminTabProps) {
  const [holidays, setHolidays] = useState<CustomHoliday[]>(initialHolidays || []);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAddRow = () => {
    setHolidays([...holidays, { id: '', company_id: companyId, name: '', date: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: 'name' | 'date', value: string) => {
    const updated = [...holidays];
    updated[index] = { ...updated[index], [field]: value };
    setHolidays(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    // Filter out empty rows
    const validHolidays = holidays.filter(h => h.name.trim() !== '' && h.date.trim() !== '');
    
    const mapped = validHolidays.map(h => ({ name: h.name, date: h.date }));
    const res = await updateCompanyHolidaysAction(mapped);
    
    setLoading(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'Benutzerdefinierte Feiertage wurden gespeichert.' });
      setTimeout(() => setMessage(null), 3000);
      setHolidays(validHolidays); // keep only valid
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} className="text-accent" /> Benutzerdefinierte Feiertage
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Fügen Sie hier Feiertage hinzu, die für Ihr Unternehmen zusätzlich oder abweichend gelten.
          </p>
        </div>
      </div>

      {message && (
        <div className="glass" style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          fontSize: '0.9rem',
          marginBottom: '1rem'
        }}>
          {message.text}
        </div>
      )}

      <div className="glass glass-card" style={{ padding: '1.5rem' }}>
        {holidays.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>Keine benutzerdefinierten Feiertage definiert.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {holidays.map((holiday, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name</label>
                  <input
                    type="text"
                    value={holiday.name}
                    onChange={(e) => handleChange(index, 'name', e.target.value)}
                    className="input-field"
                    placeholder="z.B. Betriebsausflug"
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Datum</label>
                  <input
                    type="date"
                    value={holiday.date}
                    onChange={(e) => handleChange(index, 'date', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <button
                  onClick={() => handleRemoveRow(index)}
                  className="btn btn-secondary"
                  style={{ height: '42px', width: '42px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--danger)' }}
                  title="Entfernen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={handleAddRow} className="btn btn-secondary glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={16} /> Feiertag hinzufügen
          </button>
          <button onClick={handleSave} className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={16} /> {loading ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
