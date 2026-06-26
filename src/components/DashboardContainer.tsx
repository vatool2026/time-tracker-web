"use client";

import React, { useState } from 'react';
import { logoutAction, updateSurchargeSettingsAction, updateCompanySettingsAction } from '@/app/actions';
import TimeTrackerCard from './TimeTrackerCard';
import TimesheetTable from './TimesheetTable';
import AnalyticsCharts from './AnalyticsCharts';
import EmployeeSettingsModal from './EmployeeSettingsModal';
import InviteEmployeeModal from './InviteEmployeeModal';
import ThemeToggle from './ThemeToggle';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import AdminOverview from './AdminOverview';
import { 
  Building, LogOut, Users, Download, 
  Shield, FileText, CheckCircle, AlertCircle, PlusCircle, LayoutDashboard 
} from 'lucide-react';

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  absence_code: string | null;
  note: string | null;
}

interface TimesheetSettings {
  user_id?: string;
  target_hours_monday: number;
  target_hours_tuesday: number;
  target_hours_wednesday: number;
  target_hours_thursday: number;
  target_hours_friday: number;
  target_hours_saturday: number;
  target_hours_sunday: number;
  vacation_days_entitlement: number;
  carry_over_hours: number;
  carry_over_vacation_days: number;
}

interface SurchargeSettings {
  id?: string;
  company_id?: string;
  category?: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  night_surcharge_start_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_start_time: string;
  sunday_surcharge_rate: number;
  holiday_surcharge_start_time: string;
  holiday_surcharge_rate: number;
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE';
  employment_category: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  companies?: {
    id: string;
    name: string;
    billing_period_type: string;
    billing_period_start_day: number;
  } | null;
}

interface DashboardContainerProps {
  profile: Profile;
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
  employees: Profile[] | null;
  allCategorySettings: SurchargeSettings[] | null;
  allTimesheetSettings: TimesheetSettings[] | null;
  allCompanyEntries: TimeEntry[] | null;
}

export default function DashboardContainer({
  profile,
  entries,
  timesheetSettings,
  surchargeSettings,
  employees,
  allCategorySettings,
  allTimesheetSettings,
  allCompanyEntries
}: DashboardContainerProps) {
  const isAdmin = profile.role === 'COMPANY_ADMIN' || profile.role === 'ROOT';
  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>(isAdmin ? 'admin' : 'employee');
  const [adminSubTab, setAdminSubTab] = useState<'overview' | 'employees' | 'surcharges' | 'company' | 'reports'>('overview');
  
  // Modals
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  
  // Settings forms
  const [companyName, setCompanyName] = useState<string>(profile.companies?.name || '');
  const [billingPeriodType, setBillingPeriodType] = useState<string>(profile.companies?.billing_period_type || 'CALENDAR_MONTH');
  const [billingStartDay, setBillingStartDay] = useState<number>(profile.companies?.billing_period_start_day || 1);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);



  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Find active entry
  const activeEntry = entries.find(e => e.end_time === null) || null;

  // Handle surcharge update
  const handleSurchargeUpdate = async (e: React.FormEvent<HTMLFormElement>, cat: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nightStart = formData.get('nightStart') as string;
    const nightRate = Number(formData.get('nightRate'));
    const sundayStart = formData.get('sundayStart') as string;
    const sundayRate = Number(formData.get('sundayRate'));
    const holidayStart = formData.get('holidayStart') as string;
    const holidayRate = Number(formData.get('holidayRate'));

    const res = await updateSurchargeSettingsAction(
      cat,
      nightStart + ":00", // append seconds
      nightRate,
      sundayStart + ":00",
      sundayRate,
      holidayStart + ":00",
      holidayRate
    );

    if (res.success) {
      showMsg('success', `Zuschläge für ${cat} wurden erfolgreich aktualisiert.`);
    } else {
      showMsg('error', res.message);
    }
  };

  // Handle company settings update
  const handleCompanyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await updateCompanySettingsAction(companyName, billingPeriodType, Number(billingStartDay));
    setLoading(false);

    if (res.success) {
      showMsg('success', 'Firmeneinstellungen wurden erfolgreich aktualisiert.');
    } else {
      showMsg('error', res.message);
    }
  };

  // Aggregation helper for reports
  const getEmployeeReportData = () => {
    if (!employees || !allCompanyEntries || !allTimesheetSettings || !allCategorySettings) return [];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Days in current month
    const days: Date[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return employees.map(emp => {
      // Find employee specific settings
      const empSettings = allTimesheetSettings.find(s => s.user_id === emp.id) || {
        target_hours_monday: 8,
        target_hours_tuesday: 8,
        target_hours_wednesday: 8,
        target_hours_thursday: 8,
        target_hours_friday: 8,
        target_hours_saturday: 0,
        target_hours_sunday: 0
      };

      const empSurchSettings = allCategorySettings.find(s => s.category === emp.employment_category) || {
        night_surcharge_start_time: '22:00:00',
        night_surcharge_rate: 25,
        sunday_surcharge_start_time: '00:00:00',
        sunday_surcharge_rate: 50,
        holiday_surcharge_start_time: '00:00:00',
        holiday_surcharge_rate: 100
      };

      const empEntries = allCompanyEntries.filter(e => e.user_id === emp.id);

      let targetHoursTotal = 0;
      let workedHoursTotal = 0;
      let nightHoursTotal = 0;
      let sundayHoursTotal = 0;
      let holidayHoursTotal = 0;
      let vacationDays = 0;
      let sickDays = 0;

      days.forEach(day => {
        const dateStr = day.toISOString().split('T')[0];
        
        // Target calculation
        let target = 8;
        if (!isGermanHoliday(day).isHoliday) {
          const wday = day.getDay();
          if (wday === 1) target = empSettings.target_hours_monday;
          else if (wday === 2) target = empSettings.target_hours_tuesday;
          else if (wday === 3) target = empSettings.target_hours_wednesday;
          else if (wday === 4) target = empSettings.target_hours_thursday;
          else if (wday === 5) target = empSettings.target_hours_friday;
          else if (wday === 6) target = empSettings.target_hours_saturday;
          else if (wday === 0) target = empSettings.target_hours_sunday;
        } else {
          target = 0;
        }
        targetHoursTotal += target;

        // Entry calculation
        const entry = empEntries.find(e => e.entry_date === dateStr);
        if (entry) {
          if (entry.absence_code === 'U') {
            vacationDays++;
          } else if (entry.absence_code === 'K') {
            sickDays++;
          } else if (entry.end_time) {
            const surch = calculateSurcharges(
              entry.entry_date,
              entry.start_time,
              entry.end_time,
              entry.break_minutes || 0,
              empSurchSettings
            );
            workedHoursTotal += surch.workedHours;
            nightHoursTotal += surch.nightHours;
            sundayHoursTotal += surch.sundayHours;
            holidayHoursTotal += surch.holidayHours;
          }
        }
      });

      const overtime = workedHoursTotal - targetHoursTotal;

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
        category: emp.employment_category,
        targetHours: targetHoursTotal,
        workedHours: workedHoursTotal,
        overtime,
        nightHours: nightHoursTotal,
        sundayHours: sundayHoursTotal,
        holidayHours: holidayHoursTotal,
        vacationDays,
        sickDays
      };
    });
  };

  // CSV Exporter
  const handleCSVExport = () => {
    const reportData = getEmployeeReportData();
    if (reportData.length === 0) return;

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Mitarbeiter;E-Mail;Beschäftigung;Soll-Stunden;Ist-Stunden;Überstunden;Nachtstunden;Sonntagsstunden;Feiertagsstunden;Urlaubstage;Krankheitstage\n";

    reportData.forEach(r => {
      csvContent += `${r.name};${r.email};${r.category};${r.targetHours.toFixed(1)};${r.workedHours.toFixed(2)};${r.overtime.toFixed(2)};${r.nightHours.toFixed(1)};${r.sundayHours.toFixed(1)};${r.holidayHours.toFixed(1)};${r.vacationDays};${r.sickDays}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const monthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearStr = new Date().getFullYear();
    
    link.setAttribute("download", `zeiterfassung_bericht_${yearStr}_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportRows = getEmployeeReportData();

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', paddingBottom: '4rem' }}>
      
      {/* Header Bar */}
      <header className="glass" style={{
        padding: '1.25rem 2rem',
        borderRadius: 'var(--border-radius-md)',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'between',
        marginTop: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="flex-center" style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            color: 'white',
            fontWeight: 700,
            fontSize: '1.2rem'
          }}>
            ZP
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>Zeiterfassung Pro</h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              🏢 {profile.companies?.name || 'Mein Unternehmen'}
            </span>
          </div>
        </div>



        {/* User profile & controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          marginLeft: 'auto' 
        }}>
          <div className="user-details">
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile.first_name} {profile.last_name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {profile.role === 'COMPANY_ADMIN' ? 'Admin' : (profile.role === 'ROOT' ? 'Inhaber' : 'Mitarbeiter')} ({profile.employment_category})
            </span>
          </div>

          <ThemeToggle />

          <button onClick={() => logoutAction()} className="btn btn-secondary glass" style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px' }} title="Abmelden">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Message Banner */}
      {message && (
        <div className="glass" style={{
          padding: '1rem',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'employee' ? (
        <div className="container" style={{ padding: 0 }}>
          {/* 1. Clock card & quick absence */}
          <TimeTrackerCard activeEntry={activeEntry} />
          
          {/* 2. Visual reports */}
          <AnalyticsCharts entries={entries} timesheetSettings={timesheetSettings} surchargeSettings={surchargeSettings} />
          
          {/* 3. Timesheet records spreadsheet */}
          <TimesheetTable 
            entries={entries} 
            timesheetSettings={timesheetSettings} 
            surchargeSettings={surchargeSettings} 
            currentUserId={profile.id}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        /* Admin Tab View */
        <div className="glass glass-card" style={{ padding: '2rem' }}>
          
          {/* Admin Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '2rem', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'overview', label: 'Übersicht', icon: <LayoutDashboard size={16} /> },
              { id: 'employees', label: 'Mitarbeiter verwalten', icon: <Users size={16} /> },
              { id: 'surcharges', label: 'Zuschlagsregeln', icon: <Shield size={16} /> },
              { id: 'company', label: 'Firmendetails', icon: <Building size={16} /> },
              { id: 'reports', label: 'Monatsberichte & Export', icon: <FileText size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAdminSubTab(tab.id as 'overview' | 'employees' | 'surcharges' | 'company' | 'reports')}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: adminSubTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingBottom: '0.5rem',
                  borderBottom: adminSubTab === tab.id ? '2px solid var(--accent-primary)' : 'none',
                  transition: 'color 0.2s'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-Tab content: Overview */}
          {adminSubTab === 'overview' && (
            <AdminOverview
              employees={employees}
              allCompanyEntries={allCompanyEntries}
              allCategorySettings={allCategorySettings}
            />
          )}

          {/* Sub-Tab content: Employees */}
          {adminSubTab === 'employees' && employees && (
            <div>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Firmen-Mitarbeiter</h3>
                <button onClick={() => setIsInviteModalOpen(true)} className="btn btn-primary">
                  <PlusCircle size={16} /> Mitarbeiter einladen
                </button>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Mitarbeiter</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>E-Mail</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Rolle</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Beschäftigungsart</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '120px' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{emp.first_name} {emp.last_name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{emp.email}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: emp.role === 'ROOT' ? 'rgba(239, 68, 68, 0.15)' : (emp.role === 'COMPANY_ADMIN' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                            color: emp.role === 'ROOT' ? 'var(--danger)' : (emp.role === 'COMPANY_ADMIN' ? 'var(--accent-secondary)' : 'var(--accent-primary)')
                          }}>
                            {emp.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{emp.employment_category}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="btn btn-secondary glass"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab content: Surcharges (Zuschläge) */}
          {adminSubTab === 'surcharges' && allCategorySettings && (
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Zuschlagsregeln konfigurieren</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Legen Sie die Prozentsätze und Startzeiten für Nachtarbeit, Sonntage und Feiertage je Beschäftigungsart fest.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {['FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'].map(cat => {
                  const set = allCategorySettings.find(s => s.category === cat) || {
                    night_surcharge_start_time: '22:00:00',
                    night_surcharge_rate: 25,
                    sunday_surcharge_start_time: '00:00:00',
                    sunday_surcharge_rate: 50,
                    holiday_surcharge_start_time: '00:00:00',
                    holiday_surcharge_rate: 100
                  };

                  return (
                    <form 
                      key={cat} 
                      onSubmit={(e) => handleSurchargeUpdate(e, cat)}
                      className="glass" 
                      style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}
                    >
                      <div style={{ flex: '1 1 100%', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        Kategorie: {cat}
                      </div>

                      {/* Night */}
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nacht Beginn</label>
                        <input type="time" name="nightStart" defaultValue={set.night_surcharge_start_time.slice(0,5)} className="input-field" required />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nacht Satz (%)</label>
                        <input type="number" step="0.5" name="nightRate" defaultValue={set.night_surcharge_rate} className="input-field" required />
                      </div>

                      {/* Sunday */}
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sonntag Beginn</label>
                        <input type="time" name="sundayStart" defaultValue={set.sunday_surcharge_start_time.slice(0,5)} className="input-field" required />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sonntag Satz (%)</label>
                        <input type="number" step="0.5" name="sundayRate" defaultValue={set.sunday_surcharge_rate} className="input-field" required />
                      </div>

                      {/* Holiday */}
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Feiertag Beginn</label>
                        <input type="time" name="holidayStart" defaultValue={set.holiday_surcharge_start_time.slice(0,5)} className="input-field" required />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Feiertag Satz (%)</label>
                        <input type="number" step="0.5" name="holidayRate" defaultValue={set.holiday_surcharge_rate} className="input-field" required />
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem', height: '40px', fontSize: '0.85rem' }}>
                        Regel Speichern
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tab content: Company Profil */}
          {adminSubTab === 'company' && (
            <div style={{ maxWidth: '500px' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Unternehmenseinstellungen</h3>
              
              <form onSubmit={handleCompanyUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Firma Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" required disabled={loading} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Abrechnungs-Rhythmus</label>
                  <select value={billingPeriodType} onChange={(e) => setBillingPeriodType(e.target.value)} className="input-field" style={{ appearance: 'auto' }} disabled={loading}>
                    <option value="CALENDAR_MONTH">Kalendermonat</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Start-Tag der Abrechnung</label>
                  <input type="number" min="1" max="28" value={billingStartDay} onChange={(e) => setBillingStartDay(Number(e.target.value))} className="input-field" required disabled={loading} />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading}>
                  {loading ? 'Wird gespeichert...' : 'Firmendaten Aktualisieren'}
                </button>
              </form>
            </div>
          )}

          {/* Sub-Tab content: Reports & Exports */}
          {adminSubTab === 'reports' && (
            <div>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>Monatsbericht aller Mitarbeiter</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Berichtszeitraum: Aktueller Monat</span>
                </div>
                <button onClick={handleCSVExport} className="btn btn-primary">
                  <Download size={16} /> Als CSV exportieren
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Mitarbeiter</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Soll-Std.</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Ist-Std.</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Differenz</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Nacht (h)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Sonntag (h)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Feiertag (h)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Urlaub (Tage)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Krank (Tage)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{r.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{r.targetHours.toFixed(1)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 500 }}>{r.workedHours.toFixed(2)}</td>
                        <td style={{ 
                          padding: '0.75rem 0.5rem', 
                          textAlign: 'right',
                          fontWeight: 600,
                          color: r.overtime >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {r.overtime >= 0 ? '+' : ''}{r.overtime.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{r.nightHours.toFixed(1)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{r.sundayHours.toFixed(1)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{r.holidayHours.toFixed(1)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--success)' }}>{r.vacationDays}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--danger)' }}>{r.sickDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Edit employee Modal */}
      {editingEmployee && (
        <EmployeeSettingsModal 
          employee={editingEmployee}
          settings={allTimesheetSettings?.find(s => s.user_id === editingEmployee.id) || null}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {/* Invite employee Modal */}
      {isInviteModalOpen && (
        <InviteEmployeeModal 
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={(msg) => showMsg('success', msg)}
        />
      )}

    </div>
  );
}
