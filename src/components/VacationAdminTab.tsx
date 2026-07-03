"use client";

import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  absence_code: string | null;
  note: string | null;
  deleted_at?: string | null;
}

interface TimesheetSettings {
  user_id?: string;
  vacation_days_entitlement: number;
  carry_over_vacation_days: number;
}

interface Props {
  employees: Profile[];
  allCompanyEntries: TimeEntry[];
  allTimesheetSettings: TimesheetSettings[];
}

export default function VacationAdminTab({
  employees,
  allCompanyEntries,
  allTimesheetSettings
}: Props) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  const vacationData = useMemo(() => {
    return employees.map(emp => {
      const settings = allTimesheetSettings.find(s => s.user_id === emp.id) || {
        vacation_days_entitlement: 30,
        carry_over_vacation_days: 0
      };

      const entitlement = (settings.vacation_days_entitlement || 0) + (settings.carry_over_vacation_days || 0);

      const vacationEntries = allCompanyEntries.filter(e => 
        e.user_id === emp.id &&
        e.absence_code === 'U' && 
        !e.deleted_at &&
        e.entry_date.startsWith(currentYear.toString())
      ).sort((a, b) => b.entry_date.localeCompare(a.entry_date)); // Sort newest first

      let takenDays = 0;
      let plannedDays = 0;

      vacationEntries.forEach(entry => {
        if (entry.entry_date <= todayStr) {
          takenDays++;
        } else {
          plannedDays++;
        }
      });

      const totalVerplant = takenDays + plannedDays;
      const remainingDays = entitlement - totalVerplant;

      return {
        employee: emp,
        entitlement,
        takenDays,
        plannedDays,
        totalVerplant,
        remainingDays,
        entries: vacationEntries
      };
    }).sort((a, b) => {
      const nameA = `${a.employee.first_name || ''} ${a.employee.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.employee.first_name || ''} ${b.employee.last_name || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [employees, allCompanyEntries, allTimesheetSettings, currentYear, todayStr]);

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} style={{ color: 'var(--accent-primary)' }} /> Urlaubsübersicht
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Übersicht über genommene und geplante Urlaubstage aller Mitarbeiter im Jahr {currentYear}.
          </p>
        </div>
      </div>

      {vacationData.length === 0 ? (
        <div className="glass glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
          <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Keine Mitarbeiter gefunden</h4>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {vacationData.map(item => (
            <div key={item.employee.id} className="glass glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.1)' }}
                onClick={() => setExpandedEmployee(expandedEmployee === item.employee.id ? null : item.employee.id)}
              >
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{item.employee.first_name} {item.employee.last_name}</h4>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Genommen</div>
                    <div style={{ fontWeight: 600 }}>{item.takenDays} Tage</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Geplant</div>
                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{item.plannedDays} Tage</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Übrige Tage</div>
                    <div style={{ fontWeight: 600, color: item.remainingDays < 0 ? 'var(--danger)' : 'var(--success)' }}>{item.remainingDays} Tage</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Anspruch</div>
                    <div style={{ fontWeight: 600 }}>{item.entitlement} Tage</div>
                  </div>
                </div>
                <div style={{ marginLeft: '1rem' }}>
                  {expandedEmployee === item.employee.id ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>
              
              {expandedEmployee === item.employee.id && (
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                  {item.entries.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Keine Urlaubstage im Jahr {currentYear} eingetragen.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '0.5rem', width: '150px' }}>Datum</th>
                          <th style={{ padding: '0.5rem', width: '100px' }}>Status</th>
                          <th style={{ padding: '0.5rem' }}>Notiz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.entries.map((v, i) => {
                          const isFuture = v.entry_date > todayStr;
                          return (
                            <tr key={v.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                {new Date(v.entry_date).toLocaleDateString('de-DE', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                {isFuture ? (
                                  <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                    GEPLANT
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', fontWeight: 600 }}>
                                    GENOMMEN
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                                {v.note || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
