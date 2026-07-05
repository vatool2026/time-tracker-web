"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction, updateSurchargeSettingsAction, updateCompanySettingsAction, updateUserPasswordAction, updateUserEmailAction } from '@/app/actions';
import TimeTrackerCard from './TimeTrackerCard';
import TimesheetTable from './TimesheetTable';
import AnalyticsCharts from './AnalyticsCharts';
import EmployeeSettingsModal from './EmployeeSettingsModal';
import InviteEmployeeModal from './InviteEmployeeModal';
import AbsenceCodeModal from './AbsenceCodeModal';
import CustomSelect from './CustomSelect';
import TravelAllowanceCalculator from './TravelAllowanceCalculator';

import ThemeToggle from './ThemeToggle';
import LogoUpload from './LogoUpload';
import SecuritySettings from './SecuritySettings';
import PersonalSettings from './PersonalSettings';
import CustomHolidaysAdminTab from './CustomHolidaysAdminTab';
import { isGermanHoliday } from '@/utils/holidays';
import { calculateSurcharges } from '@/utils/surchargeCalculator';
import AdminOverview from './AdminOverview';
import ImportTimeEntries from './ImportTimeEntries';
import CarryoverAdminTab from './CarryoverAdminTab';
import ComplianceAdminTab from './ComplianceAdminTab';
import ComplianceEmployeeTab from './ComplianceEmployeeTab';
import QRCodeAdminTab from './QRCodeAdminTab';
import AdminOvertimeTab from './AdminOvertimeTab';
import VacationAdminTab from './VacationAdminTab';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Building, LogOut, Users, Download, Upload,
  Shield, FileText, CheckCircle, AlertCircle, PlusCircle, LayoutDashboard,
  Clock, Calendar, CalendarDays, BarChart, Settings, MoreHorizontal, Table, ChevronDown, RefreshCw, ShieldAlert, Car, QrCode, DollarSign, User
} from 'lucide-react';
import { getEmploymentCategoryLabel } from '@/utils/employment';

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  break_logs?: any[];
  absence_code: string | null;
  note: string | null;
  deleted_at?: string | null;
  delete_reason?: string | null;
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
  category?: 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  night_surcharge_start_time: string;
  night_surcharge_end_time: string;
  night_surcharge_rate: number;
  sunday_surcharge_rate: number;
  holiday_surcharge_rate: number;
  compliance_max_hours_enabled?: boolean;
  compliance_max_hours?: number;
  compliance_rest_period_enabled?: boolean;
  compliance_rest_period_hours?: number;
  compliance_break_enabled?: boolean;
  compliance_sunday_holiday_enabled?: boolean;
  auto_break_deduction_enabled?: boolean;
}

export interface AbsenceCode {
  id: string;
  company_id: string;
  employment_category: string;
  name: string;
  code: string;
  factor: number;
}

export interface CompanyHoliday {
  id: string;
  company_id: string;
  date: string;
  name: string;
}

interface OvertimePayout {
  id: string;
  user_id: string;
  year: number;
  month: number;
  hours: number;
  note: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE';
  employment_category: 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER';
  is_minor?: boolean;
  start_date?: string | null;
  last_login?: string | null;
  company_id?: string | null;
  companies?: {
    id: string;
    name: string;
    billing_period_type: string;
    billing_period_start_day: number;
    logo_url?: string | null;
    feature_urlaub?: boolean;
    feature_abwesenheit?: boolean;
    feature_sonstiges?: boolean;
    feature_qr_tracking?: boolean;
    state?: string;
  } | null;
}

interface DashboardContainerProps {
  profile: Profile;
  entries: TimeEntry[];
  timesheetSettings: TimesheetSettings | null;
  surchargeSettings: SurchargeSettings | null;
  payouts?: OvertimePayout[];
  employees: Profile[] | null;
  allCategorySettings: SurchargeSettings[] | null;
  allTimesheetSettings: TimesheetSettings[] | null;
  allCompanyEntries: TimeEntry[] | null;
  allCompanyPayouts?: OvertimePayout[] | null;
  absenceCodes: AbsenceCode[] | null;
  qrCodes?: any[] | null;
  companyHolidays: CompanyHoliday[] | null;
}

export default function DashboardContainer({
  profile,
  entries,
  timesheetSettings,
  surchargeSettings,
  payouts = [],
  employees,
  allCategorySettings,
  allTimesheetSettings,
  allCompanyEntries,
  allCompanyPayouts = [],
  absenceCodes,
  qrCodes,
  companyHolidays
}: DashboardContainerProps) {
  const router = useRouter();
  const isAdmin = profile.role === 'COMPANY_ADMIN' || profile.role === 'ROOT';
  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>(isAdmin ? 'admin' : 'employee');
  const [adminSubTab, setAdminSubTab] = useState<'overview' | 'employees' | 'surcharges' | 'absences' | 'company' | 'carryover' | 'overtime' | 'import' | 'reports' | 'compliance' | 'settings' | 'qrcodes' | 'vacation' | 'holidays'>('overview');
  const [employeeSubTab, setEmployeeSubTab] = useState<'zeiterfassung' | 'stundenzettel' | 'urlaub' | 'statistik' | 'sonstiges' | 'einstellungen' | 'verstösse'>('zeiterfassung');
  const [adminEmployeeSubView, setAdminEmployeeSubView] = useState<'list' | 'import' | 'carryover'>('list');
  const [settingsTab, setSettingsTab] = useState<'personal' | 'general' | 'security'>('general');
  // Modals
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editingAbsenceCode, setEditingAbsenceCode] = useState<AbsenceCode | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedEmployeeForTimesheet, setSelectedEmployeeForTimesheet] = useState<string | null>(null);
  
  // Detailed Report Filters
  const [reportEmployeeId, setReportEmployeeId] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  
  // Aggregated Report Filters
  const [reportAggPeriod, setReportAggPeriod] = useState<'YTD' | 'CURRENT' | 'SPECIFIC'>('YTD');
  const [reportAggSpecificMonth, setReportAggSpecificMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Settings forms
  const [companyName, setCompanyName] = useState<string>(profile.companies?.name || '');
  const [billingPeriodType, setBillingPeriodType] = useState<string>(profile.companies?.billing_period_type || 'CALENDAR_MONTH');
  const [billingStartDay, setBillingStartDay] = useState<number>(profile.companies?.billing_period_start_day || 1);
  const [companyState, setCompanyState] = useState<string>(profile.companies?.state || '');
  
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
    const autoBreakDeduction = formData.get('autoBreakDeduction') === 'on';

    const res = await updateSurchargeSettingsAction(
      cat,
      nightStart + ":00", // append seconds
      nightEnd + ":00",
      nightRate,
      sundayRate,
      holidayRate,
      autoBreakDeduction
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
    const res = await updateCompanySettingsAction(companyName, billingPeriodType, Number(billingStartDay), companyState);
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
    const currentMonth = now.getMonth();
    
    // Days array based on selected period
    const days: Date[] = [];
    
    if (reportAggPeriod === 'CURRENT') {
      const date = new Date(year, currentMonth, 1);
      while (date.getMonth() === currentMonth) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
    } else if (reportAggPeriod === 'SPECIFIC') {
      const [sy, sm] = reportAggSpecificMonth.split('-').map(Number);
      const specificYear = sy || year;
      const specificMonth = (sm || currentMonth + 1) - 1;
      const date = new Date(specificYear, specificMonth, 1);
      while (date.getMonth() === specificMonth) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
    } else {
      // YTD: Jan 1st to end of current month
      const date = new Date(year, 0, 1);
      const endMonth = currentMonth;
      while (date.getFullYear() === year && date.getMonth() <= endMonth) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
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
        target_hours_sunday: 0,
        vacation_days_entitlement: 30,
        carry_over_vacation_days: 0,
        carry_over_hours: 0
      };

      const empSurchSettings = allCategorySettings.find(s => s.category === emp.employment_category) || {
        night_surcharge_start_time: '22:00:00',
        night_surcharge_end_time: '06:00:00',
        night_surcharge_rate: 25,
        sunday_surcharge_rate: 50,
        holiday_surcharge_rate: 100
      };

      const empEntries = allCompanyEntries.filter(e => e.user_id === emp.id && !e.deleted_at);

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
        if (emp.start_date && day < new Date(emp.start_date)) {
          target = 0;
        } else {
          const holidayInfo = isGermanHoliday(day, profile.companies?.state, companyHolidays || undefined);
          if (!holidayInfo.isHoliday) {
            const wday = day.getDay();
            if (wday === 1) target = empSettings.target_hours_monday;
            else if (wday === 2) target = empSettings.target_hours_tuesday;
            else if (wday === 3) target = empSettings.target_hours_wednesday;
            else if (wday === 4) target = empSettings.target_hours_thursday;
            else if (wday === 5) target = empSettings.target_hours_friday;
            else if (wday === 6) target = empSettings.target_hours_saturday;
            else if (wday === 0) target = empSettings.target_hours_sunday;
          } else if (holidayInfo.isHalfHoliday) {
            const wday = day.getDay();
            let regularTarget = 0;
            if (wday === 1) regularTarget = empSettings.target_hours_monday;
            else if (wday === 2) regularTarget = empSettings.target_hours_tuesday;
            else if (wday === 3) regularTarget = empSettings.target_hours_wednesday;
            else if (wday === 4) regularTarget = empSettings.target_hours_thursday;
            else if (wday === 5) regularTarget = empSettings.target_hours_friday;
            else if (wday === 6) regularTarget = empSettings.target_hours_saturday;
            else if (wday === 0) regularTarget = empSettings.target_hours_sunday;
            target = regularTarget / 2;
          } else {
            target = 0;
          }
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
              empSurchSettings,
              undefined,
              undefined,
              entry.break_logs
            );
            workedHoursTotal += surch.workedHours;
            nightHoursTotal += surch.nightHours;
            sundayHoursTotal += surch.sundayHours;
            holidayHoursTotal += surch.holidayHours;
          }
        }
      });

      const overtime = workedHoursTotal - targetHoursTotal;

      const currentYearStr = year.toString();
      const annualTakenVacationDays = empEntries.filter(e => e.absence_code === 'U' && e.entry_date.startsWith(currentYearStr)).length;
      const totalVacationEntitlement = (empSettings.vacation_days_entitlement || 0) + (empSettings.carry_over_vacation_days || 0);

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
        vacationDays, // taken in the selected period
        sickDays,
        annualTakenVacationDays,
        totalVacationEntitlement
      };
    });
  };

  const reportRows = getEmployeeReportData();

  // Filter detailed entries
  const filteredDetailedEntries = React.useMemo(() => {
    if (!reportEmployeeId || !reportStartDate || !reportEndDate || !allCompanyEntries) return [];
    
    return allCompanyEntries.filter(e => 
      e.user_id === reportEmployeeId &&
      !e.deleted_at &&
      e.entry_date >= reportStartDate &&
      e.entry_date <= reportEndDate
    ).sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.start_time.localeCompare(b.start_time));
  }, [reportEmployeeId, reportStartDate, reportEndDate, allCompanyEntries]);

  const processLogo = (logoUrl: string): Promise<{data: string, width: number, height: number} | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ data: logoUrl, width: img.width, height: img.height });
        ctx.drawImage(img, 0, 0);
        
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let hasTransparent = false;
          let isWhite = true;
          let hasNonTransparent = false;
          
          for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] < 255) hasTransparent = true;
            if (data[i+3] > 0) {
              hasNonTransparent = true;
              if (data[i] < 230 || data[i+1] < 230 || data[i+2] < 230) {
                isWhite = false;
                break;
              }
            }
          }
          
          if (hasTransparent && isWhite && hasNonTransparent) {
            for (let i = 0; i < data.length; i += 4) {
              if (data[i+3] > 0) {
                data[i] = 0;
                data[i+1] = 0;
                data[i+2] = 0;
              }
            }
            ctx.putImageData(imgData, 0, 0);
          }
          resolve({ data: canvas.toDataURL('image/png'), width: img.width, height: img.height });
        } catch (e) {
          resolve({ data: logoUrl, width: img.width, height: img.height });
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
  };

  const handlePDFExport = async () => {
    if (!filteredDetailedEntries.length) return;
    const emp = employees?.find(e => e.id === reportEmployeeId);
    if (!emp) return;

    const approxHeight = 60 + (filteredDetailedEntries.length + 1) * 12;
    const pageHeight = Math.max(297, approxHeight);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [210, pageHeight]
    });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Stundenbericht: ${emp.first_name} ${emp.last_name}`, 14, 20);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Zeitraum: ${formatDate(reportStartDate)} bis ${formatDate(reportEndDate)}`, 14, 28);

    if (profile.companies?.logo_url) {
      const logoObj = await processLogo(profile.companies.logo_url);
      if (logoObj) {
        // Max dimensions for logo
        const maxWidth = 40;
        const maxHeight = 18;
        
        const ratio = Math.min(maxWidth / logoObj.width, maxHeight / logoObj.height);
        const finalWidth = logoObj.width * ratio;
        const finalHeight = logoObj.height * ratio;
        
        // Right align the logo taking the final width into account
        const xPos = 196 - finalWidth; 
        
        doc.addImage(logoObj.data, 'PNG', xPos, 10, finalWidth, finalHeight, undefined, 'FAST');
      }
    }

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
          empSurchSettings || { night_surcharge_start_time: '22:00:00', night_surcharge_end_time: '06:00:00', night_surcharge_rate: 25, sunday_surcharge_rate: 50, holiday_surcharge_rate: 100 },
          undefined,
          undefined,
          entry.break_logs
        );
        worked = surch.workedHours;
        totalWorked += worked;
      }
      
      let status = '';
      if (entry.absence_code) {
        const customCode = absenceCodes?.find(c => c.code === entry.absence_code);
        status = customCode ? customCode.name : entry.absence_code;
        if (status === 'U') status = 'Urlaub';
        if (status === 'K') status = 'Krank';
      } else if (!entry.end_time) status = 'Offen';
      
      return [
        formatDate(entry.entry_date),
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

    doc.save(`Stundenbericht_${emp.first_name}_${emp.last_name}_${formatDate(reportStartDate)}_bis_${formatDate(reportEndDate)}.pdf`);
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
          <div className="user-details" style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>{profile.first_name} {profile.last_name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {profile.role === 'COMPANY_ADMIN' ? 'Admin' : (profile.role === 'ROOT' ? 'Inhaber' : 'Mitarbeiter')} ({getEmploymentCategoryLabel(profile.employment_category)})
            </span>
          </div>

          <button 
            onClick={() => activeTab === 'admin' ? setAdminSubTab('settings') : setEmployeeSubTab('einstellungen')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: (activeTab === 'admin' && adminSubTab === 'settings') || (activeTab === 'employee' && employeeSubTab === 'einstellungen') ? 'var(--accent-primary)' : 'var(--text-secondary)', 
              cursor: 'pointer', 
              padding: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'color 0.2s'
            }}
            title="Einstellungen"
          >
            <Settings size={20} />
          </button>

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
                { id: 'verstösse', label: 'Verstöße (ArbZG)', icon: <ShieldAlert size={16} /> },
                profile.companies?.feature_sonstiges ? { id: 'sonstiges', label: 'Fahrtkosten', icon: <Car size={16} /> } : null
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
                qrCodes={qrCodes}
                feature_qr_tracking={profile.companies?.feature_qr_tracking}
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
                startDate={profile?.start_date}
                payouts={payouts}
              />
            )}

            {employeeSubTab === 'urlaub' && (
              <div className="glass glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '2rem' }}>
                  <Calendar size={28} style={{ color: 'var(--accent-primary)' }} />
                  <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>Urlaubsverwaltung</h3>
                </div>

                {(() => {
                  const entitlement = timesheetSettings?.vacation_days_entitlement || 0;
                  const carryOver = timesheetSettings?.carry_over_vacation_days || 0;
                  const totalEntitlement = entitlement + carryOver;

                  // Find all vacation entries for the current year
                  const currentYear = new Date().getFullYear();
                  const vacationEntries = entries.filter(e => 
                    e.absence_code === 'U' && 
                    !e.deleted_at &&
                    e.entry_date.startsWith(currentYear.toString())
                  ).sort((a, b) => b.entry_date.localeCompare(a.entry_date));

                  const takenDays = vacationEntries.length;
                  const remainingDays = totalEntitlement - takenDays;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Jahresanspruch</div>
                          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{entitlement}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Tage</div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Übertrag (Vorjahr)</div>
                          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{carryOver}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Tage</div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Verplant / Genommen</div>
                          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{takenDays}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Tage</div>
                        </div>

                        <div style={{ background: 'var(--accent-gradient)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', color: 'white', boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)' }}>
                          <div style={{ fontSize: '0.85rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Resturlaub</div>
                          <div style={{ fontSize: '2.5rem', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{remainingDays}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>Tage</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Genommene / Geplante Urlaubstage ({currentYear})</h4>
                        
                        {vacationEntries.length > 0 ? (
                          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--glass-border)' }}>
                                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Datum</th>
                                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Notiz</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vacationEntries.map((entry) => {
                                  const dateObj = new Date(entry.entry_date);
                                  const isFuture = dateObj > new Date();
                                  
                                  return (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '1rem', fontWeight: 500 }}>
                                        {dateObj.toLocaleDateString('de-DE', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}
                                        {isFuture && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)' }}>GEPLANT</span>}
                                      </td>
                                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                        {entry.note || '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                            <Calendar size={32} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>Es wurden noch keine Urlaubstage für {currentYear} eingetragen.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {employeeSubTab === 'statistik' && (
              <AnalyticsCharts 
                entries={entries} 
                timesheetSettings={timesheetSettings} 
                surchargeSettings={surchargeSettings} 
                absenceCodes={absenceCodes}
                startDate={profile?.start_date}
                profile={profile}
              />
            )}

            {employeeSubTab === 'sonstiges' && (
              <TravelAllowanceCalculator entries={entries} />
            )}

            {employeeSubTab === 'verstösse' && (
              <ComplianceEmployeeTab 
                profile={profile} 
                entries={entries} 
                surchargeSettings={surchargeSettings} 
              />
            )}

            {employeeSubTab === 'einstellungen' && (
              <div style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
                  <button 
                    onClick={() => setSettingsTab('general')}
                    style={{ 
                      background: 'none', border: 'none', 
                      padding: '0.5rem 1rem', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: settingsTab === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottom: settingsTab === 'general' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Settings size={16} /> Allgemein
                  </button>
                  <button 
                    onClick={() => setSettingsTab('personal')}
                    style={{ 
                      background: 'none', border: 'none', 
                      padding: '0.5rem 1rem', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: settingsTab === 'personal' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottom: settingsTab === 'personal' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <User size={16} /> Persönliches
                  </button>
                  <button 
                    onClick={() => setSettingsTab('security')}
                    style={{ 
                      background: 'none', border: 'none', 
                      padding: '0.5rem 1rem', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: settingsTab === 'security' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      borderBottom: settingsTab === 'security' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Shield size={16} /> Sicherheit
                  </button>
                </div>

                {settingsTab === 'personal' && (
                  <PersonalSettings profile={profile} />
                )}

                {settingsTab === 'general' && (
                  <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                      <Settings size={24} style={{ color: 'var(--accent-primary)' }} />
                      <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Allgemeine Einstellungen</h3>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                      <div>
                        <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Erscheinungsbild</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Wechseln Sie zwischen hellem und dunklem Design.</p>
                      </div>
                      <ThemeToggle />
                    </div>

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
                )}

                {settingsTab === 'security' && (
                  <SecuritySettings profile={profile} />
                )}
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
              { id: 'compliance', label: 'Arbeitszeitschutz', icon: <ShieldAlert size={16} /> },
              { id: 'surcharges', label: 'Zuschlagsregeln', icon: <Shield size={16} /> },
              { id: 'absences', label: 'Kürzel', icon: <CalendarDays size={16} /> },
              { id: 'reports', label: 'Monatsberichte & Export', icon: <FileText size={16} /> },
              { id: 'overtime', label: 'Überstunden', icon: <DollarSign size={16} /> },
              { id: 'monatsabschluss', label: 'Monatsabschluss', icon: <CalendarDays size={16} /> },
              ...(profile.companies?.feature_urlaub ? [{ id: 'vacation', label: 'Urlaub', icon: <Calendar size={16} /> }] : []),
              { id: 'holidays', label: 'Feiertage', icon: <Calendar size={16} /> },
              ...(profile.companies?.feature_qr_tracking ? [{ id: 'qrcodes', label: 'QR-Codes', icon: <QrCode size={16} /> }] : []),
              { id: 'company', label: 'Firmendetails', icon: <Building size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'monatsabschluss') {
                    router.push('/dashboard/monatsabschluss');
                  } else {
                    setAdminSubTab(tab.id as any);
                  }
                }}
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
              onTabChange={(tab) => setAdminSubTab(tab as any)}
            />
          )}

          {/* Sub-Tab content: Overtime Payouts */}
          {adminSubTab === 'overtime' && employees && (
            <AdminOvertimeTab
              employees={employees}
              allCompanyPayouts={allCompanyPayouts || []}
            />
          )}

          {/* Sub-Tab content: Vacation */}
          {adminSubTab === 'vacation' && employees && (
            <VacationAdminTab
              employees={employees}
              allCompanyEntries={allCompanyEntries || []}
              allTimesheetSettings={allTimesheetSettings || []}
            />
          )}

          {/* Sub-Tab content: Employees */}
          {adminSubTab === 'employees' && employees && (
            <div>
              <div style={{ 
                display: 'inline-flex', 
                gap: '0.25rem', 
                background: 'rgba(0, 0, 0, 0.2)', 
                padding: '0.35rem', 
                borderRadius: 'var(--border-radius-md)', 
                marginBottom: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <button 
                  onClick={() => setAdminEmployeeSubView('list')}
                  style={{ 
                    background: adminEmployeeSubView === 'list' ? 'var(--accent-primary)' : 'transparent', 
                    color: adminEmployeeSubView === 'list' ? '#ffffff' : 'var(--text-secondary)', 
                    border: 'none',
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    padding: '0.5rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: 'var(--border-radius-sm)',
                    transition: 'all 0.2s ease',
                    boxShadow: adminEmployeeSubView === 'list' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                  }}
                >
                  Mitarbeiterliste
                </button>
                <button 
                  onClick={() => setAdminEmployeeSubView('import')}
                  style={{ 
                    background: adminEmployeeSubView === 'import' ? 'var(--accent-primary)' : 'transparent', 
                    color: adminEmployeeSubView === 'import' ? '#ffffff' : 'var(--text-secondary)', 
                    border: 'none',
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    padding: '0.5rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: 'var(--border-radius-sm)',
                    transition: 'all 0.2s ease',
                    boxShadow: adminEmployeeSubView === 'import' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                  }}
                >
                  Daten-Import
                </button>
                <button 
                  onClick={() => setAdminEmployeeSubView('carryover')}
                  style={{ 
                    background: adminEmployeeSubView === 'carryover' ? 'var(--accent-primary)' : 'transparent', 
                    color: adminEmployeeSubView === 'carryover' ? '#ffffff' : 'var(--text-secondary)', 
                    border: 'none',
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    padding: '0.5rem 1.25rem', 
                    fontSize: '0.9rem',
                    borderRadius: 'var(--border-radius-sm)',
                    transition: 'all 0.2s ease',
                    boxShadow: adminEmployeeSubView === 'carryover' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                  }}
                >
                  Start-Überträge
                </button>
              </div>

              {adminEmployeeSubView === 'list' && (
                <>
                  <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Mitarbeiter</h3>
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
                      <th style={{ padding: '0.75rem 0.5rem' }}>Letzter Login</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '120px' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(employees || [])].sort((a: any, b: any) => {
                      const catA = getEmploymentCategoryLabel(a.employment_category || 'OTHER');
                      const catB = getEmploymentCategoryLabel(b.employment_category || 'OTHER');
                      if (catA < catB) return -1;
                      if (catA > catB) return 1;
                      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
                      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
                      return nameA.localeCompare(nameB);
                    }).map(emp => (
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
                        <td style={{ padding: '0.75rem 0.5rem' }}>{getEmploymentCategoryLabel(emp.employment_category)}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {emp.last_login ? new Date(emp.last_login).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nie'}
                        </td>
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
                </>
              )}

              {adminEmployeeSubView === 'import' && (
                <div style={{ maxWidth: '600px' }}>
                  <ImportTimeEntries employees={employees} />
                </div>
              )}

              {adminEmployeeSubView === 'carryover' && (
                <CarryoverAdminTab
                  employees={employees}
                  allTimesheetSettings={allTimesheetSettings}
                  feature_urlaub={profile.companies?.feature_urlaub}
                />
              )}
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
                {['FULLTIME', 'AZUBI', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'].map(cat => {
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
                        Kategorie: {getEmploymentCategoryLabel(cat as string)}
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

                        {/* Auto Break Deduction */}
                        <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            name="autoBreakDeduction" 
                            id={`autoBreak_${cat}`}
                            defaultChecked={set.auto_break_deduction_enabled || false}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor={`autoBreak_${cat}`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            Automatischen Pausenabzug aktivieren (30 Min ab 6 Std, 45 Min ab 9 Std Arbeitszeit)
                          </label>
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
                    Definieren Sie hier Kürzel für Fehlzeiten (z. B. Urlaub, Krankheit) und deren Faktor für die Soll-Arbeitszeit (0.0 = Sollzeit entfällt komplett).
                  </p>
                </div>
                <button onClick={() => setEditingAbsenceCode({ id: '', company_id: '', employment_category: 'FULLTIME', name: '', code: '', factor: 1.0 })} className="btn btn-primary">
                  <PlusCircle size={16} /> Neues Kürzel
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['FULLTIME', 'AZUBI', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'].map(cat => {
                  const codes = absenceCodes?.filter(c => c.employment_category === cat) || [];

                  return (
                    <details 
                      key={cat} 
                      className="glass" 
                      style={{ borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}
                    >
                      <summary style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none' }}>
                        Kategorie: {getEmploymentCategoryLabel(cat as string)} ({codes.length} Kürzel)
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 500 }}>Bundesland für Feiertage</label>
                  <select value={companyState} onChange={(e) => setCompanyState(e.target.value)} className="input-field" disabled={loading}>
                    <option value="">Kein spezifisches Bundesland (nur bundesweite Feiertage)</option>
                    <option value="BW">Baden-Württemberg</option>
                    <option value="BY">Bayern</option>
                    <option value="BE">Berlin</option>
                    <option value="BB">Brandenburg</option>
                    <option value="HB">Bremen</option>
                    <option value="HH">Hamburg</option>
                    <option value="HE">Hessen</option>
                    <option value="MV">Mecklenburg-Vorpommern</option>
                    <option value="NI">Niedersachsen</option>
                    <option value="NW">Nordrhein-Westfalen</option>
                    <option value="RP">Rheinland-Pfalz</option>
                    <option value="SL">Saarland</option>
                    <option value="SN">Sachsen</option>
                    <option value="ST">Sachsen-Anhalt</option>
                    <option value="SH">Schleswig-Holstein</option>
                    <option value="TH">Thüringen</option>
                  </select>
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

          {/* Sub-Tab content: Custom Holidays */}
          {adminSubTab === 'holidays' && profile.company_id && (
            <div style={{ width: '100%' }}>
              <CustomHolidaysAdminTab 
                companyId={profile.company_id} 
                initialHolidays={companyHolidays || []} 
                companyState={profile.companies?.state}
              />
            </div>
          )}

          {/* Sub-Tab content: QR-Codes */}
          {adminSubTab === 'qrcodes' && qrCodes && profile.company_id && (
            <QRCodeAdminTab 
              qrCodes={qrCodes} 
              companyId={profile.company_id} 
              refreshData={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }} 
            />
          )}

          {/* Sub-Tab content: Reports & Exports */}
          {adminSubTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
              
              {/* Aggregated Report */}
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Mitarbeiterbericht</h3>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button 
                      onClick={() => setReportAggPeriod('YTD')}
                      className={`btn ${reportAggPeriod === 'YTD' ? 'btn-primary' : 'btn-secondary glass'}`}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      Jahresanfang bis aktueller Monat
                    </button>
                    <button 
                      onClick={() => setReportAggPeriod('CURRENT')}
                      className={`btn ${reportAggPeriod === 'CURRENT' ? 'btn-primary' : 'btn-secondary glass'}`}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      Nur aktueller Monat
                    </button>
                    <input 
                      type="month"
                      value={reportAggSpecificMonth}
                      onChange={(e) => {
                        setReportAggSpecificMonth(e.target.value);
                        setReportAggPeriod('SPECIFIC');
                      }}
                      onClick={() => setReportAggPeriod('SPECIFIC')}
                      style={{ 
                        padding: '0.35rem 0.5rem', 
                        fontSize: '0.85rem', 
                        height: 'auto', 
                        minWidth: '150px',
                        border: reportAggPeriod === 'SPECIFIC' ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: reportAggPeriod === 'SPECIFIC' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: reportAggPeriod === 'SPECIFIC' ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </div>
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
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--success)' }}>
                            {r.annualTakenVacationDays} / {r.totalVacationEntitlement}
                          </td>
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
                        menuPlacement="top"
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
                            const surch = calculateSurcharges(
                              entry.entry_date, 
                              entry.start_time, 
                              entry.end_time, 
                              entry.break_minutes || 0, 
                              empSurchSettings || { night_surcharge_start_time: '22:00:00', night_surcharge_end_time: '06:00:00', night_surcharge_rate: 25, sunday_surcharge_rate: 50, holiday_surcharge_rate: 100 },
                              undefined,
                              undefined,
                              entry.break_logs
                            );
                            worked = surch.workedHours;
                          }
                          
                          let status = '';
                          if (entry.absence_code) {
                            const customCode = absenceCodes?.find(c => c.code === entry.absence_code);
                            status = customCode ? customCode.name : entry.absence_code;
                            if (status === 'U') status = 'Urlaub';
                            if (status === 'K') status = 'Krank';
                          } else if (!entry.end_time) status = 'Offen';

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

          {/* Sub-Tab content: Compliance / Arbeitszeitschutz */}
          {adminSubTab === 'compliance' && (
            <div style={{ maxWidth: '1000px' }}>
              <ComplianceAdminTab 
                employees={employees || []}
                allCompanyEntries={allCompanyEntries || []}
                allCategorySettings={allCategorySettings || []}
                companyState={profile.companies?.state}
                companyHolidays={companyHolidays || undefined}
              />
            </div>
          )}

          {/* Sub-Tab content: Settings */}
          {adminSubTab === 'settings' && (
            <div style={{ maxWidth: '600px' }}>
              <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
                <button 
                  onClick={() => setSettingsTab('general')}
                  style={{ 
                    background: 'none', border: 'none', 
                    padding: '0.5rem 1rem', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: settingsTab === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: settingsTab === 'general' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Settings size={16} /> Allgemein
                </button>
                <button 
                  onClick={() => setSettingsTab('personal')}
                  style={{ 
                    background: 'none', border: 'none', 
                    padding: '0.5rem 1rem', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: settingsTab === 'personal' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: settingsTab === 'personal' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <User size={16} /> Persönliches
                </button>
                <button 
                  onClick={() => setSettingsTab('security')}
                  style={{ 
                    background: 'none', border: 'none', 
                    padding: '0.5rem 1rem', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: settingsTab === 'security' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    borderBottom: settingsTab === 'security' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Shield size={16} /> Sicherheit
                </button>
              </div>

              {settingsTab === 'personal' && (
                <PersonalSettings profile={profile} />
              )}

              {settingsTab === 'general' && (
                <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                    <Settings size={24} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Allgemeine Einstellungen</h3>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Erscheinungsbild</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Wechseln Sie zwischen hellem und dunklem Design.</p>
                    </div>
                    <ThemeToggle />
                  </div>

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
              )}

              {settingsTab === 'security' && (
                <SecuritySettings profile={profile} />
              )}
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
              startDate={employees.find(e => e.id === selectedEmployeeForTimesheet)?.start_date}
              payouts={allCompanyPayouts?.filter(p => p.user_id === selectedEmployeeForTimesheet) || []}
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
              { id: 'compliance', label: 'ArbZG', icon: <ShieldAlert size={20} /> },
              { id: 'surcharges', label: 'Zuschläge', icon: <Shield size={20} /> },
              { id: 'absences', label: 'Kürzel', icon: <CalendarDays size={20} /> },
              { id: 'reports', label: 'Berichte', icon: <FileText size={20} /> },
              { id: 'overtime', label: 'Überst.', icon: <DollarSign size={20} /> },
              { id: 'monatsabschluss', label: 'Abschluss', icon: <CalendarDays size={20} /> },
              { id: 'holidays', label: 'Feiertage', icon: <Calendar size={20} /> },
              ...(profile.companies?.feature_qr_tracking ? [{ id: 'qrcodes', label: 'QR-Codes', icon: <QrCode size={20} /> }] : []),
              { id: 'company', label: 'Firma', icon: <Building size={20} /> },
              { id: 'settings', label: 'Einstellungen', icon: <Settings size={20} /> }
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'monatsabschluss') {
                    router.push('/dashboard/monatsabschluss');
                  } else {
                    setAdminSubTab(tab.id as any);
                  }
                }}
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
