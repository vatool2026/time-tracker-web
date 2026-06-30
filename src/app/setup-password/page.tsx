"use client";

import React, { useState, Suspense } from 'react';
import { setupPasswordAction } from '@/app/actions';
import ThemeToggle from '@/components/ThemeToggle';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await setupPasswordAction(formData);

    setLoading(false);
    if (!res.success) {
      setError(res.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    }
  };

  return (
    <>
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
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={18} />
          <span>Passwort erfolgreich erstellt. Sie werden weitergeleitet...</span>
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
          {token_hash && <input type="hidden" name="token_hash" value={token_hash} />}
          {type && <input type="hidden" name="type" value={type} />}
          
          <div>
            <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="password" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Neues Passwort
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                className="input-field"
                style={{ paddingLeft: '2.5rem' }}
                disabled={loading}
              />
              <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
          </button>
        </form>
      )}
    </>
  );
}

export default function SetupPasswordPage() {
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
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Willkommen</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Bitte erstellen Sie ein Passwort, um Ihr Konto zu aktivieren.</p>
        </div>

        <Suspense fallback={<div>Laden...</div>}>
          <SetupPasswordForm />
        </Suspense>

      </div>
    </main>
  );
}
