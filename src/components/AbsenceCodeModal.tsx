"use client";

import React, { useState, useTransition } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { saveAbsenceCodeAction, deleteAbsenceCodeAction } from '@/app/actions';
import type { AbsenceCode } from './DashboardContainer';
import CustomSelect from './CustomSelect';

interface AbsenceCodeModalProps {
  absenceCode: AbsenceCode;
  onClose: () => void;
}

export default function AbsenceCodeModal({ absenceCode, onClose }: AbsenceCodeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [category, setCategory] = useState(absenceCode.employment_category || 'FULLTIME');
  const [name, setName] = useState(absenceCode.name || '');
  const [code, setCode] = useState(absenceCode.code || '');
  const [factor, setFactor] = useState(absenceCode.factor !== undefined ? absenceCode.factor.toString() : '1.0');

  const handleSave = () => {
    setError(null);
    if (!name.trim() || !code.trim() || !factor.trim()) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    
    startTransition(async () => {
      const res = await saveAbsenceCodeAction(
        absenceCode.id || null,
        category,
        name,
        code,
        parseFloat(factor)
      );
      if (res.success) {
        onClose();
      } else {
        setError(res.message);
      }
    });
  };

  const handleDelete = () => {
    if (!absenceCode.id) return;
    if (!confirm('Dieses Kürzel wirklich löschen?')) return;
    
    setError(null);
    startTransition(async () => {
      const res = await deleteAbsenceCodeAction(absenceCode.id);
      if (res.success) {
        onClose();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass glass-card" style={{
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>

        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
          {absenceCode.id ? 'Kürzel bearbeiten' : 'Neues Kürzel erstellen'}
        </h3>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mitarbeitergruppe</label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              disabled={isPending || !!absenceCode.id}
              options={[
                { value: 'FULLTIME', label: 'Vollzeit' },
                { value: 'AZUBI', label: 'Azubi' },
                { value: 'PARTTIME', label: 'Teilzeit' },
                { value: 'MIDIJOB', label: 'Midi Job' },
                { value: 'MINIJOB', label: 'Mini Job' },
                { value: 'OTHER', label: 'Sonstige' }
              ]}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Name / Bezeichnung (z.B. Urlaub)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" disabled={isPending} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Kürzel (z.B. U)</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)} className="input-field" disabled={isPending} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Faktor für Soll-Arbeitszeit (z.B. 1.0 = ganzer Tag, 0.5 = halber Tag, 0.0 = Sollzeit wird 0)</label>
            <input type="number" step="0.1" value={factor} onChange={e => setFactor(e.target.value)} className="input-field" disabled={isPending} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={handleSave} disabled={isPending} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <Save size={18} /> {isPending ? 'Speichern...' : 'Speichern'}
            </button>
            {absenceCode.id && (
              <button onClick={handleDelete} disabled={isPending} className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
