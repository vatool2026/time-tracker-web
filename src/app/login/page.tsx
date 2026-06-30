"use client";

import React, { useState } from 'react';
import { loginAction } from '@/app/actions';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { Mail, Lock, LogIn, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await loginAction(formData);

    setLoading(false);
    if (!res.success) {
      setError(res.message);
    } else {
      // Middleware redirects to dashboard automatically
      window.location.href = '/dashboard';
    }
  };

  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '1rem', position: 'relative' }}>
      
      {/* Top right theme toggle */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <div className="glass glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', zIndex: 10 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Zeiterfassung Pro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Melden Sie sich an, um Ihre Arbeitszeiten zu erfassen.</p>
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

          <div>
            <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="password" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Passwort
              </label>
              <Link href="/reset-password" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>
                Passwort vergessen?
              </Link>
            </div>
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Verbindung wird aufgebaut...' : <><LogIn size={18} /> Anmelden</>}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Noch kein Firmenkonto?{' '}
            <Link href="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              Firma registrieren <ArrowRight size={14} />
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
