"use client";

import React, { useState } from 'react';
import { resetPasswordAction } from '@/app/actions';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { Mail, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await resetPasswordAction(formData);

    setLoading(false);
    if (!res.success) {
      setError(res.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '1rem', position: 'relative' }}>
      
      {/* Top right theme toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="glass glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', zIndex: 10 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Passwort zurücksetzen</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="glass" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Falls ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen gesendet.</span>
          </div>
        )}

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
        {!success && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                E-Mail-Adresse
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@firma.de"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={loading}
                />
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Wird gesendet...' : 'Link anfordern'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <Link href="/login" style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <ArrowLeft size={14} /> Zurück zur Anmeldung
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
