"use client";

import React, { useMemo } from 'react';
import { calculateComplianceViolations } from '@/utils/complianceCalculator';
import { ShieldAlert, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  absence_code: string | null;
}

interface SurchargeSettings {
  category?: string;
  compliance_max_hours_enabled?: boolean;
  compliance_max_hours?: number;
  compliance_rest_period_enabled?: boolean;
  compliance_rest_period_hours?: number;
  compliance_break_enabled?: boolean;
  compliance_sunday_holiday_enabled?: boolean;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  employment_category: string;
}

interface Props {
  profile: Profile;
  entries: TimeEntry[];
  surchargeSettings: SurchargeSettings | null;
}

export default function ComplianceEmployeeTab({ profile, entries, surchargeSettings }: Props) {
  const complianceResults = useMemo(() => {
    const mockSettings = surchargeSettings ? { ...surchargeSettings, category: profile?.employment_category } : null;
    return calculateComplianceViolations(
      profile ? [profile] : [], 
      entries, 
      mockSettings ? [mockSettings] : []
    );
  }, [profile, entries, surchargeSettings]);

  const violations = complianceResults.length > 0 ? complianceResults[0].violations : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--danger)' }} /> Meine Arbeitszeitschutz-Verstöße
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Hier siehst du potenzielle Verstöße gegen das Arbeitszeitgesetz (ArbZG), die in deinen erfassten Zeiten gefunden wurden.
        </p>
      </div>

      {(!violations || violations.length === 0) ? (
        <div className="glass glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto', color: 'var(--success)' }} />
          <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Keine Verstöße gefunden</h4>
          <p>Es wurden keine Arbeitszeitverstöße in den erfassten Zeiten gefunden. Weiter so!</p>
        </div>
      ) : (
        violations.map((v, i) => (
          <div key={i} className="glass glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', borderLeft: `4px solid ${v.severity === 'error' ? 'var(--danger)' : 'var(--accent-secondary)'}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Datum</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {new Date(v.date).toLocaleDateString('de-DE')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              {v.severity === 'error' ? (
                <AlertTriangle size={24} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              ) : (
                <Info size={24} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: v.severity === 'error' ? 'var(--danger)' : 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {v.type}
                </h4>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {v.description}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
