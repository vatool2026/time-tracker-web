"use client";

import React, { useState } from 'react';
import { registerAction } from '@/app/actions';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { Building, User, Mail, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('passwordConfirm') as string;

    // Check passwords match
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    const res = await registerAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    } else {
      const data = res.data as { confirmationRequired?: boolean } | undefined;
      if (data?.confirmationRequired) {
        setSuccess(res.message);
      } else {
        // Re-route to dashboard automatically
        window.location.href = '/dashboard';
      }
    }
  };

  if (success) {
    return (
      <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '2rem 1rem', position: 'relative' }}>
        
        {/* Top right theme toggle */}
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
          <ThemeToggle />
        </div>

        {/* Success Card */}
        <div className="glass glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem', zIndex: 10, textAlign: 'center' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
            <CheckCircle size={64} style={{ color: '#8b5cf6' }} />
          </div>

          <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>E-Mail bestätigen</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            {success}
          </p>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
            <Link href="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '46px', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Weiter zum Login
            </Link>
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '2rem 1rem', position: 'relative' }}>
      
      {/* Top right theme toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      {/* Registration Card */}
      <div className="glass glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2.5rem', zIndex: 10 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Unternehmen registrieren</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Erstellen Sie ein Firmenkonto und Ihren Administratorzugang.</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Company Section */}
          <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Unternehmensdetails</h3>
            <div>
              <label htmlFor="companyName" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Name der Firma
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Muster GmbH"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={loading}
                />
                <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>
          </div>

          {/* Admin User Section */}
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Administrator Profil</h3>
            
            <div className="grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label htmlFor="firstName" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Vorname
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Max"
                    required
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    disabled={loading}
                  />
                  <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              <div>
                <label htmlFor="lastName" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Nachname
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Mustermann"
                    required
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    disabled={loading}
                  />
                  <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                E-Mail-Adresse
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@firma.de"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={loading}
                />
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <div className="grid-cols-2" style={{ gap: '1rem' }}>
              <div>
                <label htmlFor="password" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Passwort
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    disabled={loading}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              <div>
                <label htmlFor="passwordConfirm" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Bestätigen
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="passwordConfirm"
                    name="passwordConfirm"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    disabled={loading}
                  />
                  <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Firma wird registriert...' : <><CheckCircle size={18} /> Registrierung abschließen</>}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Bereits registriert?{' '}
            <Link href="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <ArrowLeft size={14} /> Zurück zum Login
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
