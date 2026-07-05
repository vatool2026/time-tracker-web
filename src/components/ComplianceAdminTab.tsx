"use client";

import React, { useState, useMemo } from 'react';
import { updateComplianceSettingsAction } from '@/app/actions';
import { getEmploymentCategoryLabel } from '@/utils/employment';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import { calculateComplianceViolations } from '@/utils/complianceCalculator';
import { isGermanHoliday } from '@/utils/holidays';
import { Settings, ShieldAlert, AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import type { AbsenceCode } from './DashboardContainer';

interface Props {
  employees: any[];
  allCompanyEntries: any[];
  allCategorySettings: any[];
  companyState?: string;
  companyHolidays?: any[];
}

export default function ComplianceAdminTab({
  employees,
  allCompanyEntries,
  allCategorySettings,
  companyState,
  companyHolidays
}: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSettingsUpdate = async (e: React.FormEvent<HTMLFormElement>, cat: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const maxHoursEnabled = formData.get('maxHoursEnabled') === 'on';
    const maxHours = Number(formData.get('maxHours'));
    const restPeriodEnabled = formData.get('restPeriodEnabled') === 'on';
    const restPeriodHours = Number(formData.get('restPeriodHours'));
    const breakEnabled = formData.get('breakEnabled') === 'on';
    const sundayHolidayEnabled = formData.get('sundayHolidayEnabled') === 'on';

    setLoading(true);
    const res = await updateComplianceSettingsAction(
      cat,
      maxHoursEnabled,
      maxHours,
      restPeriodEnabled,
      restPeriodHours,
      breakEnabled,
      sundayHolidayEnabled
    );
    setLoading(false);

    if (res.success) {
      showMsg('success', `Regeln für ${getEmploymentCategoryLabel(cat)} aktualisiert.`);
    } else {
      showMsg('error', res.message);
    }
  };

  // Calculate violations using the imported utility
  const violationsByEmployee = useMemo(() => {
    return calculateComplianceViolations(employees, allCompanyEntries, allCategorySettings, companyState, companyHolidays);
  }, [employees, allCompanyEntries, allCategorySettings, companyState, companyHolidays]);

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} style={{ color: 'var(--danger)' }} /> Arbeitszeitschutz (ArbZG)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Übersicht über potenzielle Verstöße gegen das Arbeitszeitgesetz. 
          </p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="btn btn-secondary glass">
          <Settings size={16} /> {showSettings ? 'Einstellungen ausblenden' : 'Einstellungen anpassen'}
        </button>
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

      {showSettings && (
        <div className="glass glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>Arbeitszeitschutz-Einstellungen pro Kategorie</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {['AZUBI', 'MIDIJOB', 'MINIJOB', 'OTHER', 'PARTTIME', 'FULLTIME'].map(cat => {
              const set = allCategorySettings.find(s => s.category === cat) || {
                compliance_max_hours_enabled: true,
                compliance_max_hours: 10,
                compliance_rest_period_enabled: true,
                compliance_rest_period_hours: 11,
                compliance_break_enabled: true,
                compliance_sunday_holiday_enabled: true
              };

              return (
                <details key={cat} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
                  <summary style={{ padding: '1rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                    {getEmploymentCategoryLabel(cat)}
                  </summary>
                  <form onSubmit={(e) => handleSettingsUpdate(e, cat)} style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input type="checkbox" name="maxHoursEnabled" defaultChecked={set.compliance_max_hours_enabled ?? true} />
                        Max. Arbeitszeit prüfen
                      </label>
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Erlaubte Std. pro Tag</label>
                        <input type="number" step="0.5" name="maxHours" defaultValue={set.compliance_max_hours ?? 10} className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input type="checkbox" name="restPeriodEnabled" defaultChecked={set.compliance_rest_period_enabled ?? true} />
                        Ruhezeiten prüfen
                      </label>
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Geforderte Ruhezeit (Std.)</label>
                        <input type="number" step="0.5" name="restPeriodHours" defaultValue={set.compliance_rest_period_hours ?? 11} className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input type="checkbox" name="breakEnabled" defaultChecked={set.compliance_break_enabled ?? true} />
                        Gesetzliche Pausen prüfen
                      </label>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 1.5rem' }}>
                        (&gt;6h = 30min, &gt;9h = 45min)
                      </p>
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input type="checkbox" name="sundayHolidayEnabled" defaultChecked={set.compliance_sunday_holiday_enabled ?? true} />
                        Sonntags-/Feiertagsarbeit melden
                      </label>
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button type="submit" disabled={loading} className="btn btn-primary">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* List of Violations */}
      {violationsByEmployee.length === 0 ? (
        <div className="glass glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto', color: 'var(--success)' }} />
          <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Keine Verstöße gefunden</h4>
          <p>Es wurden keine Arbeitszeitverstöße in den erfassten Zeiten gefunden.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {violationsByEmployee.map(item => (
            <div key={item.employee.id} className="glass glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.1)' }}
                onClick={() => setExpandedEmployee(expandedEmployee === item.employee.id ? null : item.employee.id)}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{item.employee.first_name} {item.employee.last_name}</h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 600 }}>
                    {item.violations.filter(v => v.severity === 'error').length} Verstoß/Verstöße
                  </span>
                </div>
                {expandedEmployee === item.employee.id ? <ChevronUp /> : <ChevronDown />}
              </div>
              
              {expandedEmployee === item.employee.id && (
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <th style={{ padding: '0.5rem', width: '120px' }}>Datum</th>
                        <th style={{ padding: '0.5rem' }}>Art des Verstoßes</th>
                        <th style={{ padding: '0.5rem' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.violations.map((v, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {new Date(v.date).toLocaleDateString('de-DE')}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                              color: v.severity === 'error' ? 'var(--danger)' : 'var(--accent-secondary)',
                              fontWeight: 600
                            }}>
                              <AlertTriangle size={14} /> {v.type}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {v.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
