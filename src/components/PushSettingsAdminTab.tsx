"use client";

import React, { useState, useEffect } from 'react';
import { getPushRulesAction, savePushRuleAction, togglePushRuleAction, deletePushRuleAction } from '@/app/actions';
import { Bell, Plus, Save, Trash2, Edit2, AlertCircle } from 'lucide-react';

interface PushRule {
  id: string;
  company_id: string;
  trigger_minutes: number;
  condition_break_minutes: number;
  message: string;
  is_active: boolean;
}

export default function PushSettingsAdminTab() {
  const [rules, setRules] = useState<PushRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    trigger_minutes: 345, // 5 hours 45 mins
    condition_break_minutes: 30,
    message: 'Achtung: Sie arbeiten bereits fast 6 Stunden. Eine Pause ist gesetzlich vorgeschrieben!',
    is_active: true
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    const res = await getPushRulesAction();
    if (res.success) {
      setRules(res.data);
    }
    setLoading(false);
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await savePushRuleAction(
      editingId,
      formData.trigger_minutes,
      formData.condition_break_minutes,
      formData.message,
      formData.is_active
    );
    
    if (res.success) {
      showMsg('success', res.message);
      setIsCreating(false);
      setEditingId(null);
      loadRules();
    } else {
      showMsg('error', res.message);
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const res = await togglePushRuleAction(id, !currentStatus);
    if (res.success) {
      loadRules();
    } else {
      showMsg('error', res.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Soll diese Regel wirklich gelöscht werden?')) return;
    const res = await deletePushRuleAction(id);
    if (res.success) {
      showMsg('success', res.message);
      loadRules();
    } else {
      showMsg('error', res.message);
    }
  };

  const startEdit = (rule: PushRule) => {
    setEditingId(rule.id);
    setIsCreating(false);
    setFormData({
      trigger_minutes: rule.trigger_minutes,
      condition_break_minutes: rule.condition_break_minutes,
      message: rule.message,
      is_active: rule.is_active
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} style={{ color: 'var(--accent-primary)' }} /> Push-Benachrichtigungen
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Konfiguriere, wann und welche Nachrichten an die Mitarbeiter gepusht werden.
          </p>
        </div>
        {!isCreating && !editingId && (
          <button 
            onClick={() => {
              setIsCreating(true);
              setFormData({ trigger_minutes: 345, condition_break_minutes: 30, message: '', is_active: true });
            }} 
            className="btn btn-primary"
          >
            <Plus size={16} /> Neue Regel
          </button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          marginBottom: '1.5rem'
        }}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="glass glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--accent-primary)' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>{isCreating ? 'Neue Regel erstellen' : 'Regel bearbeiten'}</h4>
          <form onSubmit={handleSave} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">Auslöser (in Min. ununterbrochener Arbeitszeit)</label>
                <input 
                  type="number" 
                  required 
                  className="input-field" 
                  value={formData.trigger_minutes}
                  onChange={e => setFormData({...formData, trigger_minutes: Number(e.target.value)})}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>z.B. 345 für 5 Std. 45 Min.</span>
              </div>
              <div>
                <label className="form-label">Bedingung: Pause kleiner als (Min.)</label>
                <input 
                  type="number" 
                  required 
                  className="input-field" 
                  value={formData.condition_break_minutes}
                  onChange={e => setFormData({...formData, condition_break_minutes: Number(e.target.value)})}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>z.B. 30 Minuten</span>
              </div>
            </div>
            <div>
              <label className="form-label">Nachricht</label>
              <textarea 
                required 
                className="input-field" 
                rows={3}
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                placeholder="Achtung: Bitte machen Sie bald eine Pause!"
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.is_active}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                />
                Regel ist aktiv
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                <Save size={16} /> Speichern
              </button>
              <button type="button" onClick={cancelEdit} className="btn btn-secondary glass" style={{ flex: 1 }}>
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !isCreating && !editingId ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Lädt...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {rules.length === 0 && !isCreating && !editingId && (
            <div className="glass glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <AlertCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
              <p>Es sind noch keine eigenen Push-Regeln konfiguriert.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Es greifen die Standard-Regeln des Systems (bei 5,75h und 8,75h).</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className="glass glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: rule.is_active ? 1 : 0.6 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  Nach {Math.floor(rule.trigger_minutes / 60)}h {rule.trigger_minutes % 60}m Arbeitszeit
                  <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                    (Wenn Pause &lt; {rule.condition_break_minutes}m)
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  "{rule.message}"
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleToggle(rule.id, rule.is_active)}
                  className={`btn ${rule.is_active ? 'btn-secondary' : 'btn-primary'} glass`}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  {rule.is_active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
                <button 
                  onClick={() => startEdit(rule)}
                  className="btn btn-secondary glass"
                  style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}
                  title="Bearbeiten"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(rule.id)}
                  className="btn btn-secondary glass"
                  style={{ padding: '0.4rem', color: 'var(--danger)' }}
                  title="Löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
