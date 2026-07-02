"use client";

import React, { useState, Suspense, useEffect } from 'react';
import { loginAction } from '@/app/actions';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient } from '@/utils/supabase/client';
import { Mail, Lock, LogIn, AlertCircle, ArrowRight, Shield, Fingerprint } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    if (urlError) {
      setError(urlError);
    }
    
    // Also check hash for Supabase specific errors
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        // Decode and translate common Supabase errors
        let displayError = decodeURIComponent(hashError.replace(/\+/g, ' '));
        if (displayError.includes('Email link is invalid or has expired')) {
          displayError = 'Der Einladungslink ist ungültig oder abgelaufen. Bitte nutzen Sie "Passwort vergessen?", um ein neues Passwort festzulegen.';
        }
        setError(displayError);
      }
    }
  }, [urlError]);

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
      const data = res.data as { mfaRequired?: boolean } | undefined;
      if (data?.mfaRequired) {
        // Fetch factors to get factorId
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          setError('Fehler beim Laden der 2FA-Faktoren.');
          return;
        }
        const totpFactor = factorsData.totp.find(f => f.status === 'verified');
        if (totpFactor) {
          setFactorId(totpFactor.id);
          setMfaRequired(true);
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        window.location.href = '/dashboard';
      }
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!factorId) return;

    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: verifyCode
    });

    setLoading(false);

    if (verifyError) {
      setError('Der eingegebene Code ist falsch.');
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: passkeyError } = await supabase.auth.signInWithPasskey();
      if (passkeyError) {
        throw passkeyError;
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError('Fehler beim Passkey-Login: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
            alignItems: 'flex-start',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
            <span style={{ lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* Form */}
        {!mfaRequired ? (
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
            
            <div style={{ position: 'relative', margin: '1.5rem 0', textAlign: 'center' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid var(--glass-border)', zIndex: 1 }}></div>
              <span style={{ position: 'relative', zIndex: 2, backgroundColor: 'var(--bg-glass)', padding: '0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>oder</span>
            </div>

            <button type="button" onClick={handlePasskeyLogin} className="btn btn-secondary" style={{ width: '100%', height: '46px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)' }} disabled={loading}>
              <Fingerprint size={18} style={{ color: 'var(--accent-primary)' }} /> Mit Passkey anmelden
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <Shield size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>2-Faktor-Authentifizierung</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.</p>
            </div>
            
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  id="verifyCode"
                  name="verifyCode"
                  type="text"
                  placeholder="000000"
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="input-field"
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.25rem' }}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading || verifyCode.length < 6}>
              {loading ? 'Wird überprüft...' : 'Code bestätigen'}
            </button>
            <button type="button" onClick={() => setMfaRequired(false)} className="btn" style={{ width: '100%', backgroundColor: 'transparent', color: 'var(--text-secondary)' }} disabled={loading}>
              Zurück zur Anmeldung
            </button>
          </form>
        )}

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
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', padding: '1rem', position: 'relative' }}>
      <Suspense fallback={<div style={{ width: '100%', maxWidth: '440px', height: '500px' }} className="glass glass-card" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
