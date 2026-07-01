"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { updateUserPasswordAction } from '@/app/actions';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Key, Lock, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';

export default function SecuritySettings({ profile }: { profile: any }) {
  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // MFA State
  const [mfaStatus, setMfaStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  
  // Passkeys State
  const [passkeys, setPasskeys] = useState<any[]>([]);

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // Load MFA and Passkey status on mount
  useEffect(() => {
    loadSecurityFactors();
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadSecurityFactors = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const totpFactor = data.totp.find(f => f.status === 'verified');
      if (totpFactor) {
        setMfaStatus('enabled');
        setMfaFactorId(totpFactor.id);
      } else {
        setMfaStatus('disabled');
      }

      const webAuthnFactors = data.all.filter(f => f.factor_type === 'webauthn' && f.status === 'verified');
      setPasskeys(webAuthnFactors);

    } catch (err) {
      console.error(err);
      setMfaStatus('disabled');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showMsg('error', 'Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showMsg('error', 'Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    const result = await updateUserPasswordAction(newPassword);
    setLoading(false);
    if (result.success) {
      showMsg('success', result.message);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showMsg('error', result.message);
    }
  };

  // Setup TOTP
  const startMfaEnrollment = async () => {
    try {
      setIsEnrollingMfa(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) throw error;
      setMfaFactorId(data.id);
      setQrCodeData(data.totp.qr_code);
    } catch (err: any) {
      showMsg('error', err.message);
      setIsEnrollingMfa(false);
    }
  };

  const verifyMfaEnrollment = async () => {
    if (!mfaFactorId || !verifyCode) return;
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;
      
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });
      
      if (verify.error) throw verify.error;
      
      showMsg('success', '2-Faktor-Authentifizierung wurde erfolgreich aktiviert.');
      setMfaStatus('enabled');
      setIsEnrollingMfa(false);
      setQrCodeData(null);
      setVerifyCode('');
    } catch (err: any) {
      showMsg('error', 'Fehler bei der Verifizierung: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!mfaFactorId) return;
    if (!confirm('Möchten Sie die 2-Faktor-Authentifizierung wirklich deaktivieren?')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      showMsg('success', '2FA wurde deaktiviert.');
      setMfaStatus('disabled');
      setMfaFactorId(null);
    } catch (err: any) {
      showMsg('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Passkey Setup
  const setupPasskey = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      
      showMsg('success', 'Passkey erfolgreich hinzugefügt!');
      loadSecurityFactors();
    } catch (err: any) {
      showMsg('error', 'Fehler beim Erstellen des Passkeys: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePasskey = async (id: string) => {
    if (!confirm('Möchten Sie diesen Passkey wirklich entfernen?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      showMsg('success', 'Passkey wurde entfernt.');
      loadSecurityFactors();
    } catch (err: any) {
      showMsg('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <Shield size={24} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Sicherheit</h3>
      </div>
      
      {/* Messages */}
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

      {/* Password Reset */}
      <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={16} /> Passwort ändern
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Setzen Sie ein neues Passwort für Ihren Account (mind. 6 Zeichen).</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Neues Passwort"
              className="input-field"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              className="input-field"
              style={{ flex: 1, minWidth: '200px' }}
            />
          </div>
          <button type="submit" disabled={loading || newPassword.length < 6 || !confirmPassword} className="btn btn-primary glass" style={{ alignSelf: 'flex-start' }}>
            Passwort speichern
          </button>
        </div>
      </form>

      {/* 2FA Setup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Smartphone size={16} /> 2-Faktor-Authentifizierung (App)
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Schützen Sie Ihren Account zusätzlich mit einer Authenticator-App (z.B. Google Authenticator, Authy).
          </p>
        </div>
        
        {mfaStatus === 'loading' ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Lade Status...</p>
        ) : mfaStatus === 'enabled' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <CheckCircle size={16} /> 2FA ist aktiviert
            </div>
            <button onClick={disableMfa} disabled={loading} className="btn btn-secondary glass">
              2FA deaktivieren
            </button>
          </div>
        ) : isEnrollingMfa && qrCodeData ? (
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <p style={{ fontSize: '0.9rem' }}>1. Scannen Sie diesen QR-Code mit Ihrer Authenticator-App:</p>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '8px' }}>
              <QRCodeSVG value={qrCodeData} size={200} />
            </div>
            <p style={{ fontSize: '0.9rem' }}>2. Geben Sie den 6-stelligen Code aus der App hier ein:</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="input-field"
                style={{ width: '120px', letterSpacing: '0.2em', textAlign: 'center' }}
              />
              <button onClick={verifyMfaEnrollment} disabled={loading || verifyCode.length !== 6} className="btn btn-primary">
                Verifizieren
              </button>
              <button onClick={() => { setIsEnrollingMfa(false); setQrCodeData(null); }} className="btn btn-secondary glass">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button onClick={startMfaEnrollment} disabled={loading} className="btn btn-secondary glass">
              2FA aktivieren
            </button>
          </div>
        )}
      </div>

      {/* Passkeys Setup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
        <div>
          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={16} /> Passkeys (Biometrie / Geräte-Login)
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Melden Sie sich schnell und sicher mit Fingerabdruck, Face ID oder PIN auf diesem Gerät an.
          </p>
        </div>

        {passkeys.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ihre gespeicherten Passkeys:</span>
            {passkeys.map(pk => (
              <div key={pk.id} className="glass flex-between" style={{ padding: '0.75rem 1rem', borderRadius: 'var(--border-radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Lock size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '0.9rem' }}>
                    Passkey (hinzugefügt am {new Date(pk.created_at).toLocaleDateString()})
                  </span>
                </div>
                <button 
                  onClick={() => removePasskey(pk.id)}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', cursor: 'pointer', padding: '0.25rem' }}
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div>
          <button onClick={setupPasskey} disabled={loading} className="btn btn-secondary glass">
            + Neuen Passkey erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
