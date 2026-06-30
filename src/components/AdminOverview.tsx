"use client";

import React, { useMemo } from 'react';
import { Users, Clock, CalendarDays, Activity, CalendarX2 } from 'lucide-react';
import { calculateSurcharges } from '@/utils/surchargeCalculator';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  employment_category: string;
  email: string;
  role: string;
}

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
  id?: string;
  company_id?: string;
  category?: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER' | string;
  night_surcharge_start_time: string;
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
}

interface AdminOverviewProps {
  employees: Profile[] | null;
  allCompanyEntries: TimeEntry[] | null;
  allCategorySettings: SurchargeSettings[] | null;
}

export default function AdminOverview({
  employees,
  allCompanyEntries,
  allCategorySettings,
}: AdminOverviewProps) {
  const stats = useMemo(() => {
    if (!employees || !allCompanyEntries) {
      return {
        totalEmployees: 0,
        activeNow: 0,
        monthlyHours: 0,
        absences: 0,
        activeEmployeesList: [],
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let activeNow = 0;
    let monthlyHours = 0;
    let absences = 0;
    const activeEmployeesList: { name: string; startTime: string; category: string }[] = [];

    // Group active entries by user
    const userMap = new Map(employees.map(e => [e.id, e]));

    allCompanyEntries.forEach((entry) => {
      const entryDate = new Date(entry.entry_date);
      const isCurrentMonth = entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      const employee = userMap.get(entry.user_id);

      // Currently active
      if (entry.end_time === null) {
        activeNow++;
        if (employee) {
          activeEmployeesList.push({
            name: `${employee.first_name} ${employee.last_name}`,
            startTime: entry.start_time,
            category: employee.employment_category
          });
        }
      }

      // Monthly stats
      if (isCurrentMonth) {
        if (entry.absence_code === 'U' || entry.absence_code === 'K') {
          absences++;
        }

        if (entry.end_time && employee && allCategorySettings) {
          const empSurchSettings = allCategorySettings.find(s => s.category === employee.employment_category) || {
            category: employee.employment_category,
            night_surcharge_start_time: '22:00:00',
            night_surcharge_end_time: '06:00:00',
            night_surcharge_rate: 25,
            sunday_surcharge_rate: 50,
            holiday_surcharge_rate: 100
          };

          const calculated = calculateSurcharges(
            entry.entry_date,
            entry.start_time,
            entry.end_time,
            entry.break_minutes || 0,
            empSurchSettings
          );
          monthlyHours += calculated.workedHours;
        }
      }
    });

    return {
      totalEmployees: employees.length,
      activeNow,
      monthlyHours: Number(monthlyHours.toFixed(1)),
      absences,
      activeEmployeesList: activeEmployeesList.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  }, [employees, allCompanyEntries, allCategorySettings]);

  return (
    <div className="admin-overview" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>Unternehmensübersicht</h3>
      
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Aktuell arbeitend</p>
            <h4 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{stats.activeNow}</h4>
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Mitarbeiter gesamt</p>
            <h4 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{stats.totalEmployees}</h4>
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-secondary)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Stunden (Monat)</p>
            <h4 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{stats.monthlyHours}</h4>
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
            <CalendarX2 size={24} />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Fehl- & Urlaubstage</p>
            <h4 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{stats.absences}</h4>
          </div>
        </div>
      </div>

      {/* Active Employees List */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-md)' }}>
        <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }}></span>
          Wer ist gerade da?
        </h4>
        
        {stats.activeEmployeesList.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem 0' }}>Name</th>
                  <th style={{ padding: '0.75rem 0' }}>Beschäftigungsart</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Gestartet um</th>
                </tr>
              </thead>
              <tbody>
                {stats.activeEmployeesList.map((emp, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{emp.name}</td>
                    <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>{emp.category}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {emp.startTime.slice(0, 5)} Uhr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CalendarDays size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
            <p>Aktuell ist niemand eingestempelt.</p>
          </div>
        )}
      </div>
    </div>
  );
}
