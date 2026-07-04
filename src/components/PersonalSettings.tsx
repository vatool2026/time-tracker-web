"use client";

import React, { useState } from 'react';
import { updateUserProfileNameAction, updateUserEmailAction } from '@/app/actions';
import { User, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function PersonalSettings({ profile }: { profile: any }) {
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [email, setEmail] = useState('');
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showMsg('error', 'Vorname und Nachname dürfen nicht leer sein.');
      return;
    }
    setLoading(true);
    const result = await updateUserProfileNameAction(firstName, lastName);
    setLoading(false);
    if (result.success) {
      showMsg('success', result.message);
    } else {
      showMsg('error', result.message);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showMsg('error', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }
    setLoading(true);
    const result = await updateUserEmailAction(email);
    setLoading(false);
    if (result.success) {
      showMsg('success', result.message);
      setEmail('');
    } else {
      showMsg('error', result.message);
    }
  };

  return (
    <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <User size={24} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Persönliche Daten</h3>
      </div>
      
      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Settings */}
      <form onSubmit={handleNameChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} /> Profil bearbeiten
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Passen Sie Ihren Namen an.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Vorname"
              className="input-field"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <input 
              type="text" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nachname"
              className="input-field"
              style={{ flex: 1, minWidth: '200px' }}
            />
          </div>
          <button type="submit" disabled={loading || !firstName.trim() || !lastName.trim()} className="btn btn-primary glass" style={{ alignSelf: 'flex-start' }}>
            Namen speichern
          </button>
        </div>
      </form>

      {/* Email Change */}
      <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={16} /> E-Mail-Adresse ändern
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Aktualisieren Sie Ihre Login-E-Mail-Adresse.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Neue E-Mail-Adresse"
            className="input-field"
            style={{ flex: 1, minWidth: '200px' }}
          />
          <button type="submit" disabled={loading || !email.includes('@')} className="btn btn-primary glass">
            E-Mail speichern
          </button>
        </div>
      </form>
    </div>
  );
}
