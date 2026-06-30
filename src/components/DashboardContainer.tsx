"use client";

import React, { useState } from 'react';
import { logoutAction, updateSurchargeSettingsAction, updateCompanySettingsAction, updateUserPasswordAction, updateUserEmailAction } from '@/app/actions';
import TimeTrackerCard from './TimeTrackerCard';
import TimesheetTable from './TimesheetTable';
import AnalyticsCharts from './AnalyticsCharts';
import EmployeeSettingsModal from './EmployeeSettingsModal';
import InviteEmployeeModal from './InviteEmployeeModal';
import AbsenceCodeModal from './AbsenceCodeModal';
import CustomSelect from './CustomSelect';

import ThemeToggle from './ThemeToggle';
import LogoUpload from './LogoUpload';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import AdminOverview from './AdminOverview';
import ImportTimeEntries from './ImportTimeEntries';
import CarryoverAdminTab from './CarryoverAdminTab';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Building, LogOut, Users, Download, Upload,
  Shield, FileText, CheckCircle, AlertCircle, PlusCircle, LayoutDashboard,
  Clock, Calendar, CalendarDays, BarChart, Settings, MoreHorizontal, Table, ChevronDown, RefreshCw
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
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
}

export interface AbsenceCode {
  id: string;
  company_id: string;
  employment_category: string;
  name: string;
  code: string;
  factor: number;
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE';
  employment_category: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  companies?: {
    id: string;
    name: string;
    billing_period_type: string;
    billing_period_start_day: number;
    logo_url?: string | null;
    feature_urlaub?: boolean;
    feature_abwesenheit?: boolean;
    feature_sonstiges?: boolean;
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
  absenceCodes: AbsenceCode[] | null;
}

export default function DashboardContainer({
  profile,
  entries,
  timesheetSettings,
  surchargeSettings,
  employees,
  allCategorySettings,
  allTimesheetSettings,
  allCompanyEntries,
  absenceCodes
}: DashboardContainerProps) {
  const isAdmin = profile.role === 'COMPANY_ADMIN' || profile.role === 'ROOT';
  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>(isAdmin ? 'admin' : 'employee');
  const [adminSubTab, setAdminSubTab] = useState<'overview' | 'employees' | 'surcharges' | 'absences' | 'company' | 'carryover' | 'import' | 'reports' | 'settings'>('overview');
  const [employeeSubTab, setEmployeeSubTab] = useState<'zeiterfassung' | 'stundenzettel' | 'urlaub' | 'statistik' | 'sonstiges' | 'einstellungen'>('zeiterfassung');
  // Modals
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editingAbsenceCode, setEditingAbsenceCode] = useState<AbsenceCode | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedEmployeeForTimesheet, setSelectedEmployeeForTimesheet] = useState<string | null>(null);
  
  // Detailed Report Filters
  const [reportEmployeeId, setReportEmployeeId] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  
  // Settings forms
  const [companyName, setCompanyName] = useState<string>(profile.companies?.name || '');
  const [billingPeriodType, setBillingPeriodType] = useState<string>(profile.companies?.billing_period_type || 'CALENDAR_MONTH');
  const [billingStartDay, setBillingStartDay] = useState<number>(profile.companies?.billing_period_start_day || 1);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // User Settings Forms
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

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

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) {
      showMsg('error', 'Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setLoading(true);
    const result = await updateUserEmailAction(newEmail);
    setLoading(false);
    if (result.success) {
      showMsg('success', result.message);
      setNewEmail('');
    } else {
      showMsg('error', result.message);
    }
  };



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
    const nightEnd = formData.get('nightEnd') as string;
    const nightRate = Number(formData.get('nightRate'));
    const sundayRate = Number(formData.get('sundayRate'));
    const holidayRate = Number(formData.get('holidayRate'));

    const res = await updateSurchargeSettingsAction(
      cat,
      nightStart + ":00", // append seconds
      nightEnd + ":00",
      nightRate,
      sundayRate,
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
        night_surcharge_end_time: '06:00:00',
        night_surcharge_rate: 25,
        sunday_surcharge_rate: 50,
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

  const reportRows = getEmployeeReportData();

  // Filter detailed entries
  const filteredDetailedEntries = React.useMemo(() => {
    if (!reportEmployeeId || !reportStartDate || !reportEndDate || !allCompanyEntries) return [];
    
    return allCompanyEntries.filter(e => 
      e.user_id === reportEmployeeId &&
      e.entry_date >= reportStartDate &&
      e.entry_date <= reportEndDate
    ).sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.start_time.localeCompare(b.start_time));
  }, [reportEmployeeId, reportStartDate, reportEndDate, allCompanyEntries]);

  const handlePDFExport = () => {
    if (!filteredDetailedEntries.length) return;
    const emp = employees?.find(e => e.id === reportEmployeeId);
    if (!emp) return;

    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Stundenbericht: ${emp.first_name} ${emp.last_name}`, 14, 20);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Zeitraum: ${reportStartDate} bis ${reportEndDate}`, 14, 28);

    const empSurchSettings = allCategorySettings?.find(s => s.category === emp.employment_category);

    let totalWorked = 0;
    
    const tableData = filteredDetailedEntries.map(entry => {
      let worked = 0;
      if (entry.end_time) {
        const surch = calculateSurcharges(
          entry.entry_date,
          entry.start_time,
          entry.end_time,
          entry.break_minutes || 0,
          empSurchSettings || { night_surcharge_start_time: '22:00:00', night_surcharge_end_time: '06:00:00', night_surcharge_rate: 25, sunday_surcharge_rate: 50, holiday_surcharge_rate: 100 }
        );
        worked = surch.workedHours;
        totalWorked += worked;
      }
      
      let status = '';
      if (entry.absence_code === 'U') status = 'Urlaub';
      else if (entry.absence_code === 'K') status = 'Krank';
      else if (!entry.end_time) status = 'Offen';
      
      return [
        entry.entry_date,
        status ? '-' : entry.start_time.slice(0, 5),
        status ? '-' : (entry.end_time ? entry.end_time.slice(0, 5) : '-'),
        status ? '-' : `${entry.break_minutes || 0}m`,
        status ? status : worked.toFixed(2),
        entry.note || ''
      ];
    });

    tableData.push([
      'Summe',
      '',
      '',
      '',
      totalWorked.toFixed(2),
      ''
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Datum', 'Beginn', 'Ende', 'Pause', 'Ist-Std / Status', 'Notiz']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`Stundenbericht_${emp.first_name}_${emp.last_name}_${reportStartDate}_bis_${reportEndDate}.pdf`);
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


  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', paddingBottom: '4rem' }}>
      
      {/* Header Bar */}
      <header className="glass compact-header" style={{
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
          {profile.companies?.logo_url ? (
            <div style={{
              height: '42px',
              maxWidth: '160px',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src={profile.companies.logo_url} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
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
          )}
          <div>
            <h1 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>Zeiterfassung Pro</h1>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              🏢 {profile.companies?.name || 'Mein Unternehmen'}
            </span>
          </div>
        </div>



        {/* User profile & controls */}
        <div className="hidden-mobile" style={{ 
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

          {profile.role === 'ROOT' && (
            <button onClick={() => window.location.href = '/root'} className="btn btn-primary glass" style={{ padding: '0.5rem 1rem' }} title="System-Übersicht">
              System-Übersicht
            </button>
          )}
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
      <main style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Toggle between Employee and Admin views (only visible for ROOT) */}
        {profile.role === 'ROOT' && (
          <div className="glass hidden-mobile" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', margin: '0 auto', maxWidth: '400px', width: '100%' }}>
            <button
              onClick={() => setActiveTab('employee')}
              className={`btn ${activeTab === 'employee' ? 'btn-primary' : ''}`}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              Mitarbeiter
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`btn ${activeTab === 'admin' ? 'btn-primary' : ''}`}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              Admin
            </button>
          </div>
        )}

        {activeTab === 'employee' ? (
          <div className="container" style={{ padding: 0 }}>
          {/* Employee Navigation */}
          <div className="glass glass-card hidden-mobile" style={{ padding: '1rem 2rem', marginBottom: '2rem' }}>
            {/* Desktop Navigation */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'zeiterfassung', label: 'Zeiterfassung', icon: <Clock size={16} /> },
                { id: 'stundenzettel', label: 'Stundenzettel', icon: <Table size={16} /> },
                profile.companies?.feature_urlaub ? { id: 'urlaub', label: 'Urlaub', icon: <Calendar size={16} /> } : null,
                { id: 'statistik', label: 'Statistik', icon: <BarChart size={16} /> },
                profile.companies?.feature_sonstiges ? { id: 'sonstiges', label: 'Sonstiges', icon: <MoreHorizontal size={16} /> } : null,
                { id: 'einstellungen', label: 'Einstellungen', icon: <Settings size={16} /> }
              ].filter(Boolean).map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setEmployeeSubTab(tab.id as any)}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: employeeSubTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0',
                    borderBottom: employeeSubTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'color 0.2s'
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            </div>

          <div style={{ padding: 0 }}>
            {employeeSubTab === 'zeiterfassung' && (
              <TimeTrackerCard 
                activeEntry={activeEntry} 
                currentUserId={profile.id} 
                feature_urlaub={profile.companies?.feature_urlaub}
                feature_abwesenheit={profile.companies?.feature_abwesenheit}
              />
            )}
            
            {employeeSubTab === 'stundenzettel' && (
              <TimesheetTable 
                entries={entries} 
                timesheetSettings={timesheetSettings} 
                surchargeSettings={surchargeSettings} 
                currentUserId={profile.id}
                isAdmin={isAdmin}
                absenceCodes={absenceCodes}
              />
            )}

            {employeeSubTab === 'urlaub' && (
              <div className="glass glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                <Calendar size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Urlaubsverwaltung</h3>
                <p>Hier können Sie zukünftig Urlaub beantragen und Ihren Resturlaub einsehen.</p>
              </div>
            )}

            {employeeSubTab === 'statistik' && (
              <AnalyticsCharts 
                entries={entries} 
                timesheetSettings={timesheetSettings} 
                surchargeSettings={surchargeSettings} 
                absenceCodes={absenceCodes}
              />
            )}

            {employeeSubTab === 'sonstiges' && (
              <div className="glass glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                <MoreHorizontal size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Sonstiges</h3>
                <p>Weitere Funktionen und Informationen folgen in Kürze.</p>
              </div>
            )}

            {employeeSubTab === 'einstellungen' && (
              <div style={{ maxWidth: '600px' }}>
                <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <Settings size={24} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Einstellungen</h3>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Erscheinungsbild</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Wechseln Sie zwischen hellem und dunklem Design.</p>
                    </div>
                    <ThemeToggle />
                  </div>

                  <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem 0', borderTop: '1px solid var(--glass-border)' }}>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Passwort ändern</h4>
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

                  <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem 0', borderTop: '1px solid var(--glass-border)' }}>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>E-Mail-Adresse ändern</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Aktualisieren Sie Ihre Login-E-Mail-Adresse.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <input 
                        type="email" 
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Neue E-Mail-Adresse"
                        className="input-field"
                        style={{ flex: 1, minWidth: '200px' }}
                      />
                      <button type="submit" disabled={loading || !newEmail.includes('@')} className="btn btn-primary glass">
                        E-Mail speichern
                      </button>
                    </div>
                  </form>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Abmelden</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Beenden Sie Ihre aktuelle Sitzung sicher.</p>
                    </div>
                    <button onClick={() => logoutAction()} className="btn btn-secondary glass" style={{ padding: '0.5rem 1rem' }}>
                      <LogOut size={16} /> Abmelden
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Admin Tab View */
        <div className="glass glass-card" style={{ padding: '2rem' }}>
          
          {/* Admin Navigation */}
          {/* Desktop Admin Navigation */}
          <div className="hidden-mobile" style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '2rem', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'overview', label: 'Übersicht', icon: <LayoutDashboard size={16} /> },
              { id: 'employees', label: 'Mitarbeiter verwalten', icon: <Users size={16} /> },
              { id: 'surcharges', label: 'Zuschlagsregeln', icon: <Shield size={16} /> },
              { id: 'absences', label: 'Kürzel (Fehlgründe)', icon: <CalendarDays size={16} /> },
              { id: 'company', label: 'Firmendetails', icon: <Building size={16} /> },
              { id: 'carryover', label: 'Start-Überträge', icon: <Clock size={16} /> },
              { id: 'import', label: 'Daten-Import', icon: <Upload size={16} /> },
              { id: 'reports', label: 'Monatsberichte & Export', icon: <FileText size={16} /> },
              { id: 'settings', label: 'Einstellungen', icon: <Settings size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAdminSubTab(tab.id as 'overview' | 'employees' | 'surcharges' | 'absences' | 'company' | 'carryover' | 'import' | 'reports' | 'settings')}
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
                  padding: '0.5rem 0',
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

          {/* Sub-Tab content: Carryover */}
          {adminSubTab === 'carryover' && (
            <CarryoverAdminTab
              employees={employees}
              allTimesheetSettings={allTimesheetSettings}
              feature_urlaub={profile.companies?.feature_urlaub}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'].map(cat => {
                  const set = allCategorySettings.find(s => s.category === cat) || {
                    night_surcharge_start_time: '22:00:00',
                    night_surcharge_end_time: '06:00:00',
                    night_surcharge_rate: 25,
                    sunday_surcharge_rate: 50,
                    holiday_surcharge_rate: 100
                  };

                  return (
                    <details 
                      key={cat} 
                      className="glass" 
                      style={{ borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}
                    >
                      <summary style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none' }}>
                        Kategorie: {cat}
                      </summary>
                      <form 
                        onSubmit={(e) => handleSurchargeUpdate(e, cat)}
                        style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
                      >
                        {/* Night */}
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nacht Beginn</label>
                          <input type="time" name="nightStart" defaultValue={set.night_surcharge_start_time.slice(0,5)} className="input-field" required />
                        </div>
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nacht Ende</label>
                          <input type="time" name="nightEnd" defaultValue={(set.night_surcharge_end_time || "06:00:00").slice(0,5)} className="input-field" required />
                        </div>
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Nacht Satz (%)</label>
                          <input type="number" step="0.5" name="nightRate" defaultValue={set.night_surcharge_rate} className="input-field" required />
                        </div>

                        {/* Sunday */}
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Sonntag Satz (%)</label>
                          <input type="number" step="0.5" name="sundayRate" defaultValue={set.sunday_surcharge_rate} className="input-field" required />
                        </div>

                        {/* Holiday */}
                        <div style={{ flex: '1 1 100px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Feiertag Satz (%)</label>
                          <input type="number" step="0.5" name="holidayRate" defaultValue={set.holiday_surcharge_rate} className="input-field" required />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem', height: '40px', fontSize: '0.85rem' }}>
                          Regel Speichern
                        </button>
                      </form>
                    </details>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tab content: Absences (Kürzel) */}
          {adminSubTab === 'absences' && (
            <div>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Anwesenheits-/Fehlgründe (Kürzel) konfigurieren</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    Definieren Sie hier Kürzel für Fehlzeiten (z. B. Urlaub, Krankheit) und deren Faktor für die Soll-Arbeitszeit. 
                  </p>
                </div>
                <button onClick={() => setEditingAbsenceCode({ id: '', company_id: '', employment_category: 'FULLTIME', name: '', code: '', factor: 1.0 })} className="btn btn-primary">
                  <PlusCircle size={16} /> Neues Kürzel
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'].map(cat => {
                  const codes = absenceCodes?.filter(c => c.employment_category === cat) || [];

                  return (
                    <details 
                      key={cat} 
                      className="glass" 
                      style={{ borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}
                    >
                      <summary style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none' }}>
                        Kategorie: {cat} ({codes.length} Kürzel)
                      </summary>
                      
                      <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        {codes.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>Keine Kürzel für diese Kategorie definiert.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '1rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                <th style={{ padding: '0.5rem 0' }}>Name / Bezeichnung</th>
                                <th style={{ padding: '0.5rem 0' }}>Kürzel</th>
                                <th style={{ padding: '0.5rem 0' }}>Faktor (0.0 - 1.0)</th>
                                <th style={{ padding: '0.5rem 0', width: '80px', textAlign: 'right' }}>Aktion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {codes.map(code => (
                                <tr key={code.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', fontSize: '0.9rem' }}>
                                  <td style={{ padding: '0.75rem 0' }}>{code.name}</td>
                                  <td style={{ padding: '0.75rem 0', fontWeight: 600, color: 'var(--accent-secondary)' }}>{code.code}</td>
                                  <td style={{ padding: '0.75rem 0' }}>{code.factor.toFixed(2)}</td>
                                  <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                                    <button 
                                      onClick={() => setEditingAbsenceCode(code)}
                                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginRight: '0.5rem' }}
                                    >
                                      Bearbeiten
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </details>
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
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Abrechnungszeitraum</label>
                  <CustomSelect
                    value={billingPeriodType}
                    onChange={setBillingPeriodType}
                    disabled={loading}
                    options={[
                      { value: 'CALENDAR_MONTH', label: 'Kalendermonat' },
                      { value: 'CUSTOM_MONTH', label: 'Ab bestimmtem Tag im Monat' },
                      { value: 'WEEKLY', label: 'Wöchentlich' }
                    ]}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Start-Tag der Abrechnung</label>
                  <input type="number" min="1" max="28" value={billingStartDay} onChange={(e) => setBillingStartDay(Number(e.target.value))} className="input-field" required disabled={loading} />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '46px', marginTop: '0.5rem' }} disabled={loading}>
                  {loading ? 'Wird gespeichert...' : 'Firmendaten Aktualisieren'}
                </button>
              </form>

              {profile.companies?.id && (
                <LogoUpload currentLogoUrl={profile.companies.logo_url || null} companyId={profile.companies.id} />
              )}
            </div>
          )}

          {/* Sub-Tab content: Import */}
          {adminSubTab === 'import' && (
            <div style={{ maxWidth: '600px' }}>
              <ImportTimeEntries employees={employees} />
            </div>
          )}

          {/* Sub-Tab content: Reports & Exports */}
          {adminSubTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              
              {/* Aggregated Report */}
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
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                            <button 
                              onClick={() => setSelectedEmployeeForTimesheet(r.id)}
                              style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit', fontFamily: 'inherit' }}
                              title={`${r.name}'s Stundenzettel anzeigen`}
                            >
                              {r.name}
                            </button>
                          </td>
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

              {/* Detailed Report */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Detaillierter Mitarbeiterbericht (PDF Export)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Wählen Sie einen Mitarbeiter und einen Zeitraum, um alle detaillierten Einträge als PDF zu exportieren.
                </p>

                <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mitarbeiter</label>
                      <CustomSelect
                        value={reportEmployeeId}
                        onChange={setReportEmployeeId}
                        options={[
                          { value: '', label: '-- Bitte wählen --' },
                          ...(employees?.map(emp => ({ value: emp.id, label: `${emp.first_name} ${emp.last_name}` })) || [])
                        ]}
                      />
                    </div>
                    
                    <div style={{ flex: '1 1 150px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Startdatum</label>
                      <input 
                        type="date" 
                        value={reportStartDate} 
                        onChange={e => setReportStartDate(e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <div style={{ flex: '1 1 150px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Enddatum</label>
                      <input 
                        type="date" 
                        value={reportEndDate} 
                        onChange={e => setReportEndDate(e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <button 
                      onClick={handlePDFExport}
                      disabled={!reportEmployeeId || !reportStartDate || !reportEndDate || filteredDetailedEntries.length === 0}
                      className="btn btn-primary"
                      style={{ height: '46px', opacity: (!reportEmployeeId || !reportStartDate || !reportEndDate || filteredDetailedEntries.length === 0) ? 0.5 : 1 }}
                    >
                      <Download size={16} /> Als PDF exportieren
                    </button>
                  </div>
                </div>

                {filteredDetailedEntries.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Datum</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Beginn</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Ende</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Pause</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Ist-Std / Status</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Notiz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetailedEntries.map(entry => {
                          const empSurchSettings = allCategorySettings?.find(s => s.category === employees?.find(e => e.id === reportEmployeeId)?.employment_category);
                          let worked = 0;
                          if (entry.end_time) {
                            const surch = calculateSurcharges(entry.entry_date, entry.start_time, entry.end_time, entry.break_minutes || 0, empSurchSettings || { night_surcharge_start_time: '22:00:00', night_surcharge_end_time: '06:00:00', night_surcharge_rate: 25, sunday_surcharge_rate: 50, holiday_surcharge_rate: 100 });
                            worked = surch.workedHours;
                          }
                          
                          let status = '';
                          if (entry.absence_code === 'U') status = 'Urlaub';
                          else if (entry.absence_code === 'K') status = 'Krank';
                          else if (!entry.end_time) status = 'Offen';

                          return (
                            <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.9rem' }}>
                              <td style={{ padding: '0.75rem 0.5rem' }}>{entry.entry_date}</td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>{status ? '—' : entry.start_time.slice(0, 5)}</td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>{status ? '—' : (entry.end_time ? entry.end_time.slice(0, 5) : '—')}</td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>{status ? '—' : `${entry.break_minutes || 0}m`}</td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{status ? <span style={{ color: status === 'Urlaub' ? 'var(--success)' : 'var(--danger)' }}>{status}</span> : worked.toFixed(2)}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{entry.note || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {(reportEmployeeId && reportStartDate && reportEndDate && filteredDetailedEntries.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Keine Einträge für diesen Zeitraum gefunden.
                  </div>
                )}

              </div>

            </div>
          )}

          {/* Sub-Tab content: Settings */}
          {adminSubTab === 'settings' && (
            <div style={{ maxWidth: '600px' }}>
              <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  <Settings size={24} style={{ color: 'var(--accent-primary)' }} />
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Benutzereinstellungen</h3>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Erscheinungsbild</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Wechseln Sie zwischen hellem und dunklem Design.</p>
                  </div>
                  <ThemeToggle />
                </div>

                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem 0', borderTop: '1px solid var(--glass-border)' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Passwort ändern</h4>
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

                <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem 0', borderTop: '1px solid var(--glass-border)' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>E-Mail-Adresse ändern</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Aktualisieren Sie Ihre Login-E-Mail-Adresse.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <input 
                      type="email" 
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Neue E-Mail-Adresse"
                      className="input-field"
                      style={{ flex: 1, minWidth: '200px' }}
                    />
                    <button type="submit" disabled={loading || !newEmail.includes('@')} className="btn btn-primary glass">
                      E-Mail speichern
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Abmelden</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Beenden Sie Ihre aktuelle Sitzung sicher.</p>
                  </div>
                  <button onClick={() => logoutAction()} className="btn btn-secondary glass" style={{ padding: '0.5rem 1rem' }}>
                    <LogOut size={16} /> Abmelden
                  </button>
                </div>
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
          feature_urlaub={profile.companies?.feature_urlaub}
        />
      )}

      {/* Absence Code Modal */}
      {editingAbsenceCode && (
        <AbsenceCodeModal
          absenceCode={editingAbsenceCode}
          onClose={() => setEditingAbsenceCode(null)}
        />
      )}

      {/* Invite employee Modal */}
      {isInviteModalOpen && (
        <InviteEmployeeModal 
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={(msg) => showMsg('success', msg)}
        />
      )}

      {/* Employee Timesheet Modal for Admin */}
      {selectedEmployeeForTimesheet && employees && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
            <button 
              onClick={() => setSelectedEmployeeForTimesheet(null)} 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10 }}
            >
              ×
            </button>
            <h2 style={{ fontSize: '1.5rem', margin: 0, marginBottom: '0.5rem', paddingRight: '2rem' }}>
              Stundenzettel: {employees.find(e => e.id === selectedEmployeeForTimesheet)?.first_name} {employees.find(e => e.id === selectedEmployeeForTimesheet)?.last_name}
            </h2>
            
            <TimesheetTable 
              entries={allCompanyEntries?.filter(e => e.user_id === selectedEmployeeForTimesheet) || []} 
              timesheetSettings={allTimesheetSettings?.find(s => s.user_id === selectedEmployeeForTimesheet) || null} 
              surchargeSettings={allCategorySettings?.find(s => s.category === employees.find(e => e.id === selectedEmployeeForTimesheet)?.employment_category) || null} 
              currentUserId={selectedEmployeeForTimesheet}
              isAdmin={true}
            />
          </div>
        </div>
      )}
      </main>

      {/* Mobile Bottom Bar */}
      <div className="mobile-only glass mobile-bottom-bar" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        zIndex: 100,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderTop: '1px solid var(--glass-border)'
      }}>
        <div className="mobile-scroll-nav" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'flex-start', gap: '0.25rem' }}>
          {activeTab === 'employee' ? (
            [
              { id: 'zeiterfassung', label: 'Zeiterfassung', icon: <Clock size={20} /> },
              { id: 'stundenzettel', label: 'Stundenzettel', icon: <Table size={20} /> },
              profile.companies?.feature_urlaub ? { id: 'urlaub', label: 'Urlaub', icon: <Calendar size={20} /> } : null,
              { id: 'statistik', label: 'Statistik', icon: <BarChart size={20} /> },
              profile.companies?.feature_sonstiges ? { id: 'sonstiges', label: 'Sonstiges', icon: <MoreHorizontal size={20} /> } : null,
              { id: 'einstellungen', label: 'Einstellungen', icon: <Settings size={20} /> }
            ].filter(Boolean).map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setEmployeeSubTab(tab.id as any)}
                style={{
                  flex: '1 0 auto',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                  background: 'transparent', border: 'none',
                  color: employeeSubTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  padding: '0.5rem 0.25rem', minWidth: '65px', cursor: 'pointer'
                }}
              >
                {tab.icon}
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{tab.label}</span>
              </button>
            ))
          ) : (
            [
              { id: 'overview', label: 'Übersicht', icon: <LayoutDashboard size={20} /> },
              { id: 'employees', label: 'Mitarbeiter', icon: <Users size={20} /> },
              { id: 'surcharges', label: 'Zuschläge', icon: <Shield size={20} /> },
              { id: 'absences', label: 'Kürzel', icon: <CalendarDays size={20} /> },
              { id: 'company', label: 'Firma', icon: <Building size={20} /> },
              { id: 'carryover', label: 'Überträge', icon: <Clock size={20} /> },
              { id: 'import', label: 'Import', icon: <Upload size={20} /> },
              { id: 'reports', label: 'Berichte', icon: <FileText size={20} /> },
              { id: 'settings', label: 'Einstellungen', icon: <Settings size={20} /> }
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setAdminSubTab(tab.id as any)}
                style={{
                  flex: '1 0 auto',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                  background: 'transparent', border: 'none',
                  color: adminSubTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  padding: '0.5rem 0.25rem', minWidth: '70px', cursor: 'pointer'
                }}
              >
                {tab.icon}
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{tab.label}</span>
              </button>
            ))
          )}
          
          {profile.role === 'ROOT' && (
            <button 
              onClick={() => setActiveTab(activeTab === 'employee' ? 'admin' : 'employee')}
              style={{
                flex: '1 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                padding: '0.5rem 0.25rem', minWidth: '70px', cursor: 'pointer'
              }}
            >
              <RefreshCw size={20} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{activeTab === 'employee' ? 'Zu Admin' : 'Zu Mitarbeiter'}</span>
            </button>
          )}

          {profile.role === 'ROOT' && (
            <button 
              onClick={() => window.location.href = '/root'} 
              style={{
                flex: '1 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                padding: '0.5rem 0.25rem', minWidth: '70px', cursor: 'pointer'
              }}
            >
              <Shield size={20} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>System</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
