"use client";

import React, { useState, useMemo } from 'react';
import { updateCompanyHolidaysAction } from '@/app/actions';
import { PlusCircle, Trash2, Save, Calendar, CheckSquare, Square } from 'lucide-react';
import { getGermanHolidays } from '@/utils/holidays';

interface CustomHoliday {
  id?: string;
  company_id?: string;
  name: string;
  date: string; // YYYY-MM-DD
}

interface CustomHolidaysAdminTabProps {
  companyId: string;
  initialHolidays: CustomHoliday[];
  companyState?: string;
}

export default function CustomHolidaysAdminTab({ companyId, initialHolidays, companyState }: CustomHolidaysAdminTabProps) {
  
  // Separate them
  const [customHolidays, setCustomHolidays] = useState<(CustomHoliday & { factor: number })[]>(
    initialHolidays ? initialHolidays
      .filter(h => h.name !== '__DISABLED__' && h.name !== '__HALF__')
      .map(h => {
        let name = h.name;
        let factor = 1;
        if (name.includes('(1/2)')) {
          name = name.replace(' (1/2)', '').replace('(1/2)', '').trim();
          factor = 0.5;
        }
        return { ...h, name, factor };
      }) : []
  );

  const [publicHolidayFactors, setPublicHolidayFactors] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (initialHolidays) {
      initialHolidays.forEach(h => {
        if (h.name === '__DISABLED__') {
          map[h.date] = 0;
        } else if (h.name === '__HALF__') {
          map[h.date] = 0.5;
        }
      });
    }
    return map;
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const currentYear = new Date().getFullYear();
  
  // Generate public holidays for current and next year
  const publicHolidays = useMemo(() => {
    const h1 = getGermanHolidays(currentYear, companyState);
    const h2 = getGermanHolidays(currentYear + 1, companyState);
    const combined = new Map([...h1, ...h2]);
    // Sort by date
    return Array.from(combined.entries())
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentYear, companyState]);

  const handlePublicHolidayFactorChange = (date: string, factor: number) => {
    setPublicHolidayFactors(prev => {
      const next = { ...prev };
      if (factor === 1) {
        delete next[date]; // default
      } else {
        next[date] = factor;
      }
      return next;
    });
  };

  const handleAddCustomRow = () => {
    setCustomHolidays([...customHolidays, { name: '', date: '', factor: 1 }]);
  };

  const handleRemoveCustomRow = (index: number) => {
    setCustomHolidays(customHolidays.filter((_, i) => i !== index));
  };

  const handleCustomChange = (index: number, field: 'name' | 'date' | 'factor', value: string | number) => {
    const updated = [...customHolidays];
    updated[index] = { ...updated[index], [field]: value };
    setCustomHolidays(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    
    // Valid custom holidays
    const validCustom = customHolidays
      .filter(h => h.name.trim() !== '' && h.date.trim() !== '')
      .map(h => ({ name: h.factor === 0.5 ? `${h.name} (1/2)` : h.name, date: h.date }));
      
    // Public holiday overrides
    const publicOverrides = Object.entries(publicHolidayFactors)
      .map(([date, factor]) => {
        if (factor === 0) return { name: '__DISABLED__', date };
        if (factor === 0.5) return { name: '__HALF__', date };
        return null;
      })
      .filter(Boolean) as { name: string, date: string }[];
    
    const mappedToSave = [...validCustom, ...publicOverrides];

    const res = await updateCompanyHolidaysAction(mappedToSave);
    
    setLoading(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'Feiertage wurden gespeichert.' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} className="text-accent" /> Feiertagsverwaltung
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Aktivieren/Deaktivieren Sie gesetzliche Feiertage und fügen Sie eigene Unternehmens-Feiertage hinzu.
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

      {/* Gesetzliche Feiertage */}
      <div className="glass glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Gesetzliche Feiertage</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Basierend auf dem eingestellten Bundesland in den Firmendetails.
        </p>

        <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {[currentYear, currentYear + 1].map(year => {
            const yearHolidays = publicHolidays.filter(h => h.date.startsWith(year.toString()));
            return (
              <div key={year} style={{ marginBottom: '2rem' }}>
                <h5 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  Feiertage im Jahr {year}
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {yearHolidays.map((holiday) => {
                    const factor = publicHolidayFactors[holiday.date] ?? (holiday.name.includes('(1/2)') ? 0.5 : 1);
                    // the displayed name shouldn't have (1/2) since we show it in the dropdown
                    const displayName = holiday.name.replace(' (1/2)', '').replace('(1/2)', '');
                    const isActive = factor > 0;
                    
                    return (
                      <div 
                        key={holiday.date} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem', 
                          borderRadius: 'var(--border-radius-sm)', 
                          background: isActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${isActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)'}`,
                          opacity: isActive ? 1 : 0.6,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatDate(holiday.date)}</div>
                        </div>
                        <select 
                          value={factor} 
                          onChange={(e) => handlePublicHolidayFactorChange(holiday.date, parseFloat(e.target.value))}
                          style={{ 
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            backgroundColor: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                            color: isActive ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.15rem 0',
                            width: '40px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                          title="Faktor (1 = Voll, 0.5 = Halb, 0 = Ignoriert)"
                        >
                          <option value={1}>1</option>
                          <option value={0.5}>0.5</option>
                          <option value={0}>0</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Benutzerdefinierte Feiertage */}
      <div className="glass glass-card" style={{ padding: '1.5rem' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Benutzerdefinierte Feiertage</h4>
        {customHolidays.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>Keine benutzerdefinierten Feiertage definiert.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {customHolidays.map((holiday, index) => (
              <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name</label>
                  <input
                    type="text"
                    value={holiday.name}
                    onChange={(e) => handleCustomChange(index, 'name', e.target.value)}
                    className="input-field"
                    placeholder="z.B. Betriebsausflug"
                    required
                  />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Faktor</label>
                  <select
                    value={holiday.factor}
                    onChange={(e) => handleCustomChange(index, 'factor', parseFloat(e.target.value))}
                    className="input-field"
                  >
                    <option value={1}>Ganz (100%)</option>
                    <option value={0.5}>Halb (50%)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Datum</label>
                  <input
                    type="date"
                    value={holiday.date}
                    onChange={(e) => handleCustomChange(index, 'date', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <button
                  onClick={() => handleRemoveCustomRow(index)}
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
          <button onClick={handleAddCustomRow} className="btn btn-secondary glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
