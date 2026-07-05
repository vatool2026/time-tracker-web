"use client";

import React, { useState } from 'react';
import { inviteEmployeeAction } from '@/app/actions';
import { X } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface InviteEmployeeModalProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function InviteEmployeeModal({ onClose, onSuccess }: InviteEmployeeModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [role, setRole] = useState('EMPLOYEE');
  const [employmentCategory, setEmploymentCategory] = useState('FULLTIME');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE';
    const employmentCategory = formData.get('employmentCategory') as 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
    const startDateRaw = formData.get('startDate') as string;
    const startDate = startDateRaw ? startDateRaw : null;

    const res = await inviteEmployeeAction(firstName, lastName, email, role, employmentCategory, startDate);
    setLoading(false);

    if (res.success) {
      onSuccess(res.message);
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '2rem',
        position: 'relative',
        background: 'var(--bg-primary)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>

        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Mitarbeiter einladen</h3>

        {errorMsg && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '4px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: '0.85rem'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Vorname</label>
              <input type="text" name="firstName" className="input-field" required disabled={loading} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Nachname</label>
              <input type="text" name="lastName" className="input-field" required disabled={loading} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>E-Mail-Adresse</label>
            <input type="email" name="email" className="input-field" required disabled={loading} />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Rolle</label>
              <CustomSelect
                name="role"
                value={role}
                onChange={setRole}
                disabled={loading}
                options={[
                  { value: 'EMPLOYEE', label: 'Mitarbeiter' },
                  { value: 'COMPANY_ADMIN', label: 'Admin' }
                ]}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Kategorie</label>
              <CustomSelect
                name="employmentCategory"
                value={employmentCategory}
                onChange={setEmploymentCategory}
                disabled={loading}
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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Eintrittsdatum (optional)</label>
            <input type="date" name="startDate" className="input-field" disabled={loading} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', height: '44px' }} disabled={loading}>
            {loading ? 'Lädt ein...' : 'Einladung senden'}
          </button>
        </form>
      </div>
    </div>
  );
}
