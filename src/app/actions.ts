"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Helper to dynamically determine the site URL for redirects.
 */
async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  try {
    const headersList = await headers();
    const host = headersList.get('host');
    if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }
  } catch (error) {
    // Ignore error if not in request context
  }
  
  return 'http://localhost:3000';
}

export interface ActionResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Gets the current date in local YYYY-MM-DD format for Europe/Berlin.
 */
function getLocalDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Rounds a time string to the nearest 15 minutes.
 */
function roundTimeTo15Min(timeStr: string): string {
  if (!timeStr) return timeStr;
  
  let [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  
  const roundedMinutes = Math.round(minutes / 15) * 15;
  
  if (roundedMinutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  } else {
    minutes = roundedMinutes;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/**
 * Gets the current time in local HH:MM:SS format for Europe/Berlin, rounded to nearest 15 mins.
 */
function getLocalTimeString(): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  return roundTimeTo15Min(`${hour}:${minute}`);
}

/**
 * Formats error messages, specifically handling cases where Supabase SDK wraps fetch errors
 * resulting in empty object stringification '{}' or 'fetch failed' when a project is paused.
 */
function formatErrorMessage(error: { message?: string } | null | undefined, fallbackMessage: string): string {
  if (!error) return fallbackMessage;
  
  const msg = error.message;
  
  if (!msg || msg === '{}' || (typeof msg === 'string' && msg.trim() === '{}')) {
    return `${fallbackMessage} (Verbindungsfehler. Bitte prüfen Sie, ob das Supabase-Projekt aktiv ist und die Internetverbindung steht)`;
  }
  
  if (msg === 'fetch failed') {
    return `${fallbackMessage} (Verbindung zu Supabase fehlgeschlagen. Ist das Projekt pausiert?)`;
  }
  
  return `${fallbackMessage}: ${msg}`;
}

export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, message: 'Bitte E-Mail und Passwort eingeben.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler bei der Anmeldung') };
  }

  const mfaLevel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaLevel.data?.nextLevel === 'aal2') {
    return { success: true, message: 'MFA erforderlich', data: { mfaRequired: true } };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true, message: 'Erfolgreich angemeldet.', data: { mfaRequired: false } };
}

export async function registerAction(formData: FormData): Promise<ActionResponse> {
  const companyName = formData.get('companyName') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!companyName || !firstName || !lastName || !email || !password) {
    return { success: false, message: 'Bitte alle Felder ausfüllen.' };
  }

  const supabase = await createClient();

  // 1. Sign up user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { success: false, message: formatErrorMessage(authError, 'Fehler bei der Registrierung') };
  }

  const userId = authData.user.id;
  const confirmationRequired = !authData.session;

  // 2. Create the company with a client-generated UUID to bypass RLS select constraints during signup
  const companyId = crypto.randomUUID();
  const { error: companyError } = await supabase
    .from('companies')
    .insert({
      id: companyId,
      name: companyName,
      billing_period_type: 'CALENDAR_MONTH',
      billing_period_start_day: 1,
    });

  if (companyError) {
    // Attempt rollback/delete auth user if possible, but keep it simple
    return { success: false, message: formatErrorMessage(companyError, 'Fehler beim Erstellen der Firma') };
  }

  // 3. Create the user profile (as COMPANY_ADMIN)
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      company_id: companyId,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'COMPANY_ADMIN',
      employment_category: 'FULLTIME',
    });

  if (profileError) {
    return { success: false, message: `Fehler beim Erstellen des Profils: ${profileError.message}` };
  }

  // 4. Create default Category Settings for all categories for this company
  const categories = ['FULLTIME', 'AZUBI', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'];
  const categoryInserts = categories.map(cat => ({
    company_id: companyId,
    category: cat,
    night_surcharge_start_time: '22:00:00',
    night_surcharge_end_time: '06:00:00',
    night_surcharge_rate: 25.0,
    sunday_surcharge_rate: 50.0,
    holiday_surcharge_rate: 100.0
  }));

  const { error: surchargeError } = await supabase
    .from('category_settings')
    .insert(categoryInserts);

  if (surchargeError) {
    return { success: false, message: `Fehler beim Erstellen der Standardzuschläge: ${surchargeError.message}` };
  }

  // 5. Create default Timesheet Settings for the admin user for the current year
  const currentYear = new Date().getFullYear();
  const { error: timesheetError } = await supabase
    .from('timesheet_settings')
    .insert({
      user_id: userId,
      year: currentYear,
      carry_over_hours: 0.0,
      vacation_days_entitlement: 30.0,
      carry_over_vacation_days: 0.0,
      target_hours_monday: 8.0,
      target_hours_tuesday: 8.0,
      target_hours_wednesday: 8.0,
      target_hours_thursday: 8.0,
      target_hours_friday: 8.0,
      target_hours_saturday: 0.0,
      target_hours_sunday: 0.0,
    });

  if (timesheetError) {
    return { success: false, message: `Fehler beim Erstellen der Zeiteinstellungen: ${timesheetError.message}` };
  }

  revalidatePath('/dashboard', 'layout');
  return { 
    success: true, 
    message: confirmationRequired 
      ? 'Unternehmen registriert. Bitte bestätigen Sie Ihre E-Mail-Adresse in Ihrem Posteingang, um sich anzumelden.' 
      : 'Unternehmen erfolgreich registriert.',
    data: { confirmationRequired } 
  };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/login');
  redirect('/login');
}

/**
 * Clock in: Inserts a new time entry starting now.
 */
export async function clockInAction(note: string = '', qr_code_id: string | null = null, offlineTimestamp?: string): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const today = offlineTimestamp ? new Date(offlineTimestamp).toISOString().split('T')[0] : getLocalDateString();
  const nowTime = offlineTimestamp 
    ? new Date(offlineTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
    : getLocalTimeString();

  // Check if there is already an active entry for today
  const { data: existing, error: checkError } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('entry_date', today)
    .is('end_time', null);

  if (checkError) return { success: false, message: checkError.message };

  if (existing && existing.length > 0) {
    return { success: false, message: 'Sie sind bereits eingestempelt.' };
  }

  // Insert entry
  const { error } = await supabase
    .from('time_entries')
    .insert({
      user_id: user.id,
      entry_date: today,
      start_time: nowTime,
      break_minutes: 0,
      note: note || null,
      qr_code_id: qr_code_id,
    });

  if (error) return { success: false, message: `Fehler beim Einstempeln: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Erfolgreich eingestempelt.' };
}

/**
 * Clock out: Updates the active entry for today with end_time.
 */
export async function clockOutAction(note: string = '', offlineTimestamp?: string): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const nowTime = offlineTimestamp 
    ? new Date(offlineTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
    : getLocalTimeString();

  // Find active entry (either today or older, but usually today)
  const { data: activeEntries, error: findError } = await supabase
    .from('time_entries')
    .select('id, note')
    .eq('user_id', user.id)
    .is('end_time', null)
    .order('entry_date', { ascending: false });

  if (findError) return { success: false, message: findError.message };

  if (!activeEntries || activeEntries.length === 0) {
    return { success: false, message: 'Kein aktiver Zeiteintrag zum Ausstempeln gefunden.' };
  }

  const active = activeEntries[0];
  const updatedNote = note ? (active.note ? `${active.note} | ${note}` : note) : active.note;

  const { error } = await supabase
    .from('time_entries')
    .update({
      end_time: nowTime,
      note: updatedNote,
    })
    .eq('id', active.id);

  if (error) return { success: false, message: `Fehler beim Ausstempeln: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Erfolgreich ausgestempelt.' };
}

/**
 * Increments pause duration for the active time entry.
 */
export async function recordBreakAction(minutes: number): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Find active entry
  const { data: activeEntries, error: findError } = await supabase
    .from('time_entries')
    .select('id, break_minutes')
    .eq('user_id', user.id)
    .is('end_time', null)
    .order('entry_date', { ascending: false });

  if (findError) return { success: false, message: findError.message };

  if (!activeEntries || activeEntries.length === 0) {
    return { success: false, message: 'Kein aktiver Zeiteintrag gefunden. Pause kann nur im eingestempelten Zustand erfasst werden.' };
  }

  const active = activeEntries[0];
  const newBreak = (active.break_minutes || 0) + minutes;

  const { error } = await supabase
    .from('time_entries')
    .update({
      break_minutes: newBreak,
    })
    .eq('id', active.id);

  if (error) return { success: false, message: `Fehler beim Buchen der Pause: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: `Pause von ${minutes} Minuten erfolgreich verbucht.` };
}

/**
 * Sets the absence code for an entire day
 */
export async function setDayAbsenceCodeAction(userId: string, dateStr: string, code: string | null, note?: string | null): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Validate permission: can only edit own entries or must be admin
  if (user.id !== userId) {
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!caller || (caller.role !== 'COMPANY_ADMIN' && caller.role !== 'ROOT')) {
      return { success: false, message: 'Keine Berechtigung, Einträge anderer zu bearbeiten.' };
    }
  }

  // Get all entries for this date
  const { data: existing } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', dateStr);

  if (!code) {
    // Clear code from day
    if (existing && existing.length > 0) {
      // Find dummy entries (00:00:00 - 00:00:00) and delete them
      const dummyEntries = existing.filter(e => e.start_time === '00:00:00' && e.end_time === '00:00:00' && e.break_minutes === 0);
      if (dummyEntries.length > 0) {
        await supabase.from('time_entries').delete().in('id', dummyEntries.map(e => e.id));
      }
      
      // Clear absence_code on the remaining entries
      const remainingIds = existing.map(e => e.id).filter(id => !dummyEntries.some(d => d.id === id));
      if (remainingIds.length > 0) {
        await supabase.from('time_entries').update({ absence_code: null }).in('id', remainingIds);
      }
    }
    revalidatePath('/dashboard');
    return { success: true, message: 'Kürzel entfernt.' };
  } else {
    // Set code for day
    if (existing && existing.length > 0) {
      // Update all entries for this day with the new absence_code
      const { error } = await supabase
        .from('time_entries')
        .update({ absence_code: code, note: note !== undefined ? note : undefined })
        .in('id', existing.map(e => e.id));
        
      if (error) return { success: false, message: `Fehler: ${error.message}` };
    } else {
      // No entries exist, create a dummy entry to hold the code
      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: userId,
          entry_date: dateStr,
          start_time: '00:00:00',
          end_time: '00:00:00',
          break_minutes: 0,
          absence_code: code,
          note: note || `Code: ${code}`
        });
        
      if (error) return { success: false, message: `Fehler: ${error.message}` };
    }
    revalidatePath('/dashboard');
    return { success: true, message: 'Kürzel erfolgreich gesetzt.' };
  }
}

/**
 * Admin action: saves an absence code
 */
export async function saveAbsenceCodeAction(
  id: string | null,
  category: string,
  name: string,
  code: string,
  factor: number
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  if (id) {
    const { error } = await supabase
      .from('absence_codes')
      .update({ name, code, factor })
      .eq('id', id)
      .eq('company_id', callerProfile.company_id);
    if (error) return { success: false, message: error.message };
  } else {
    const { error } = await supabase
      .from('absence_codes')
      .insert({
        company_id: callerProfile.company_id,
        employment_category: category,
        name,
        code,
        factor
      });
    if (error) return { success: false, message: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Kürzel gespeichert.' };
}

/**
 * Admin action: deletes an absence code
 */
export async function deleteAbsenceCodeAction(id: string): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  const { error } = await supabase
    .from('absence_codes')
    .delete()
    .eq('id', id)
    .eq('company_id', callerProfile.company_id);

  if (error) return { success: false, message: error.message };

  revalidatePath('/dashboard');
  return { success: true, message: 'Kürzel gelöscht.' };
}

/**
 * Admin action: updates an employee's profile and timesheet settings.
 */
export async function updateEmployeeSettingsAction(
  employeeId: string,
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE',
  employmentCategory: 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER',
  carryOverHours: number,
  vacationDaysEntitlement: number,
  carryOverVacationDays: number,
  targets: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  },
  employeeNumber?: string | null,
  isMinor?: boolean,
  startDate?: string | null
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role,
      employment_category: employmentCategory,
      employee_number: employeeNumber !== undefined ? employeeNumber : undefined,
      is_minor: isMinor !== undefined ? isMinor : undefined,
      start_date: startDate !== undefined ? startDate : undefined,
    })
    .eq('id', employeeId)
    .eq('company_id', callerProfile.company_id); // Security: check same company

  if (profileError) return { success: false, message: `Fehler beim Aktualisieren des Mitarbeiterprofils: ${profileError.message}` };

  // Update or insert timesheet settings for the current year
  const currentYear = new Date().getFullYear();
  
  const { data: existingSettings } = await supabase
    .from('timesheet_settings')
    .select('id')
    .eq('user_id', employeeId)
    .eq('year', currentYear);

  const payload = {
    carry_over_hours: carryOverHours,
    vacation_days_entitlement: vacationDaysEntitlement,
    carry_over_vacation_days: carryOverVacationDays,
    target_hours_monday: targets.monday,
    target_hours_tuesday: targets.tuesday,
    target_hours_wednesday: targets.wednesday,
    target_hours_thursday: targets.thursday,
    target_hours_friday: targets.friday,
    target_hours_saturday: targets.saturday,
    target_hours_sunday: targets.sunday,
  };

  if (existingSettings && existingSettings.length > 0) {
    const { error: tsError } = await supabase
      .from('timesheet_settings')
      .update(payload)
      .eq('user_id', employeeId)
      .eq('year', currentYear);

    if (tsError) return { success: false, message: `Fehler beim Aktualisieren der Arbeitszeit-Einstellungen: ${tsError.message}` };
  } else {
    const { error: tsError } = await supabase
      .from('timesheet_settings')
      .insert({
        user_id: employeeId,
        year: currentYear,
        ...payload,
      });

    if (tsError) return { success: false, message: `Fehler beim Erstellen der Arbeitszeit-Einstellungen: ${tsError.message}` };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Mitarbeiter-Einstellungen erfolgreich aktualisiert.' };
}

/**
 * Admin action: updates surcharge (Zuschlags-) settings for a specific category.
 */
export async function updateSurchargeSettingsAction(
  category: string,
  nightStart: string,
  nightEnd: string,
  nightRate: number,
  sundayRate: number,
  holidayRate: number
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  // Update category settings
  const { error } = await supabase
    .from('category_settings')
    .update({
      night_surcharge_start_time: nightStart,
      night_surcharge_end_time: nightEnd,
      night_surcharge_rate: nightRate,
      sunday_surcharge_rate: sundayRate,
      holiday_surcharge_rate: holidayRate,
    })
    .eq('company_id', callerProfile.company_id)
    .eq('category', category);

  if (error) return { success: false, message: `Fehler beim Aktualisieren der Zuschläge: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Zuschlagsregeln erfolgreich aktualisiert.' };
}

/**
 * Admin action: updates compliance settings for a specific category.
 */
export async function updateComplianceSettingsAction(
  category: string,
  maxHoursEnabled: boolean,
  maxHours: number,
  restPeriodEnabled: boolean,
  restPeriodHours: number,
  breakEnabled: boolean,
  sundayHolidayEnabled: boolean
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  const { error } = await supabase
    .from('category_settings')
    .update({
      compliance_max_hours_enabled: maxHoursEnabled,
      compliance_max_hours: maxHours,
      compliance_rest_period_enabled: restPeriodEnabled,
      compliance_rest_period_hours: restPeriodHours,
      compliance_break_enabled: breakEnabled,
      compliance_sunday_holiday_enabled: sundayHolidayEnabled,
    })
    .eq('company_id', callerProfile.company_id)
    .eq('category', category);

  if (error) return { success: false, message: `Fehler beim Aktualisieren der Compliance-Regeln: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Arbeitszeitschutz-Regeln erfolgreich aktualisiert.' };
}

/**
 * Admin action: updates company settings.
 */
export async function updateCompanySettingsAction(
  name: string,
  billingPeriodType: string,
  billingPeriodStartDay: number
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name,
      billing_period_type: billingPeriodType,
      billing_period_start_day: billingPeriodStartDay,
    })
    .eq('id', callerProfile.company_id);

  if (error) return { success: false, message: `Fehler beim Aktualisieren der Firmeneinstellungen: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Firmeneinstellungen erfolgreich aktualisiert.' };
}

/**
 * Deletes a time entry by its ID.
 */
export async function deleteTimeEntryAction(entryId: string, reason: string): Promise<ActionResponse> {
  if (!reason || reason.trim() === '') {
    return { success: false, message: 'Ein Grund für die Löschung muss angegeben werden.' };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Delete only if it belongs to user OR caller is admin
  const { data: entry } = await supabase
    .from('time_entries')
    .select('user_id')
    .eq('id', entryId)
    .single();

  if (!entry) return { success: false, message: 'Eintrag nicht gefunden.' };

  if (entry.user_id !== user.id) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
      return { success: false, message: 'Keine Berechtigung zum Löschen dieses Eintrags.' };
    }
  }

  const { error } = await supabase
    .from('time_entries')
    .update({
      deleted_at: new Date().toISOString(),
      delete_reason: reason
    })
    .eq('id', entryId);

  if (error) return { success: false, message: `Fehler beim Löschen des Eintrags: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Eintrag erfolgreich gelöscht.' };
}

/**
 * Updates an existing time entry (e.g., manual correction by employee).
 */
export async function updateTimeEntryAction(
  entryId: string,
  startTime: string,
  endTime: string,
  breakMinutes: number,
  note: string,
  editReason: string
): Promise<ActionResponse> {
  if (!editReason || editReason.trim() === '') {
    return { success: false, message: 'Ein Grund für die Bearbeitung muss zwingend angegeben werden.' };
  }

  const roundedStartTime = roundTimeTo15Min(startTime);
  const roundedEndTime = endTime ? roundTimeTo15Min(endTime) : '';

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Verify ownership or admin rights
  const { data: entry } = await supabase
    .from('time_entries')
    .select('user_id')
    .eq('id', entryId)
    .single();

  if (!entry) return { success: false, message: 'Eintrag nicht gefunden.' };

  if (entry.user_id !== user.id) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
      return { success: false, message: 'Keine Berechtigung zum Bearbeiten dieses Eintrags.' };
    }
  }

  const { error } = await supabase
    .from('time_entries')
    .update({
      start_time: roundedStartTime,
      end_time: roundedEndTime || null,
      break_minutes: breakMinutes,
      note: note || null,
      edit_reason: editReason
    })
    .eq('id', entryId);

  if (error) return { success: false, message: `Fehler beim Bearbeiten des Eintrags: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Eintrag erfolgreich bearbeitet.' };
}

/**
 * Creates a retroactive or manual time entry for a specific day.
 */
export async function createManualTimeEntryAction(
  targetUserId: string,
  entryDate: string,
  startTime: string,
  endTime: string,
  breakMinutes: number,
  note: string,
  editReason: string
): Promise<ActionResponse> {
  // Note: editReason is optional for new manual entries, as per user request.

  const roundedStartTime = roundTimeTo15Min(startTime);
  const roundedEndTime = endTime ? roundTimeTo15Min(endTime) : '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check permissions: user can create for themselves. Admins can create for others in their company.
  if (targetUserId !== user.id) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
      return { success: false, message: 'Keine Berechtigung zum Erfassen für andere Mitarbeiter.' };
    }
  }

  // Check if an entry already exists for this date.
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', targetUserId)
    .eq('entry_date', entryDate);

  if (existing && existing.length > 0) {
    return { success: false, message: 'Für diesen Tag existiert bereits ein Eintrag. Bitte diesen bearbeiten.' };
  }

  const { error } = await supabase
    .from('time_entries')
    .insert({
      user_id: targetUserId,
      entry_date: entryDate,
      start_time: roundedStartTime,
      end_time: roundedEndTime || null,
      break_minutes: breakMinutes,
      note: note || null,
      edit_reason: editReason
    });

  if (error) return { success: false, message: `Fehler beim Erstellen des Eintrags: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Eintrag erfolgreich nachgetragen.' };
}

/**
 * Admin action: Invites a new employee using the Supabase Admin API.
 */
export async function inviteEmployeeAction(
  firstName: string,
  lastName: string,
  email: string,
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE',
  employmentCategory: 'FULLTIME' | 'AZUBI' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER',
  startDate?: string | null
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  // Use the service role key to invite user without affecting the current session
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { success: false, message: 'Serverkonfigurationsfehler: SUPABASE_SERVICE_ROLE_KEY fehlt.' };
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // 1. Invite the user
  const siteUrl = await getSiteUrl();
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/setup-password`
  });

  if (inviteError || !inviteData.user) {
    return { success: false, message: formatErrorMessage(inviteError, 'Fehler beim Einladen des Nutzers') };
  }

  const newUserId = inviteData.user.id;

  // 2. Create the user profile
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: newUserId,
      company_id: callerProfile.company_id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      employment_category: employmentCategory,
      start_date: startDate !== undefined ? startDate : undefined,
    });

  if (profileError) {
    // Attempt rollback/delete auth user if possible
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return { success: false, message: `Fehler beim Erstellen des Profils: ${profileError.message}` };
  }

  // 3. Create default Timesheet Settings for the new user for the current year
  const currentYear = new Date().getFullYear();
  const { error: timesheetError } = await supabaseAdmin
    .from('timesheet_settings')
    .insert({
      user_id: newUserId,
      year: currentYear,
      carry_over_hours: 0.0,
      vacation_days_entitlement: 30.0,
      carry_over_vacation_days: 0.0,
      target_hours_monday: 8.0,
      target_hours_tuesday: 8.0,
      target_hours_wednesday: 8.0,
      target_hours_thursday: 8.0,
      target_hours_friday: 8.0,
      target_hours_saturday: 0.0,
      target_hours_sunday: 0.0,
    });

  if (timesheetError) {
    return { success: false, message: `Fehler beim Erstellen der Zeiteinstellungen: ${timesheetError.message}` };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Mitarbeiter erfolgreich eingeladen. Eine E-Mail wurde versendet.' };
}

/**
 * Sets a new password for a user who has just accepted an invite.
 */
export async function setupPasswordAction(formData: FormData): Promise<ActionResponse> {
  const password = formData.get('password') as string;
  const token_hash = formData.get('token_hash') as string | null;
  const type = formData.get('type') as string | null;
  const code = formData.get('code') as string | null;

  if (!password) {
    return { success: false, message: 'Bitte ein Passwort eingeben.' };
  }

  const supabase = await createClient();

  if (code) {
    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
    if (codeError) {
      return { success: false, message: formatErrorMessage(codeError, 'Ungültiger oder abgelaufener Link') };
    }
  } else if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    if (otpError) {
      return { success: false, message: formatErrorMessage(otpError, 'Ungültiger oder abgelaufener Link') };
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: 'Nicht authentifiziert oder ungültiger Link.' };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Setzen des Passworts') };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Passwort erfolgreich gesetzt.' };
}

/**
 * Admin action: updates company logo URL.
 */
export async function updateCompanyLogoAction(logoUrl: string | null): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  const { error } = await supabase
    .from('companies')
    .update({ logo_url: logoUrl })
    .eq('id', callerProfile.company_id);

  if (error) return { success: false, message: `Fehler beim Aktualisieren des Logos: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Firmenlogo erfolgreich aktualisiert.' };
}

export type ExcelImportEntry = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  absenceCode: string | null;
  note: string | null;
};

export async function importExcelTimeEntriesAction(userId: string, entries: ExcelImportEntry[]): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check admin rights
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  // Ensure target user belongs to same company
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
    return { success: false, message: 'Zielbenutzer gehört nicht zum eigenen Unternehmen.' };
  }

  // Prepare insert payload
  const insertPayload = entries.map(e => ({
    user_id: userId,
    entry_date: e.date,
    start_time: e.startTime || '00:00:00', // For absence only, time can be 00:00
    end_time: e.endTime || (e.startTime ? e.startTime : '00:00:00'),
    break_minutes: e.breakMinutes,
    absence_code: e.absenceCode,
    note: e.note,
  }));

  if (insertPayload.length === 0) {
    return { success: false, message: 'Keine gültigen Einträge zum Importieren gefunden.' };
  }

  // Determine date range to delete existing entries
  const minDate = entries.reduce((min, e) => e.date < min ? e.date : min, entries[0].date);
  const maxDate = entries.reduce((max, e) => e.date > max ? e.date : max, entries[0].date);

  // Delete existing entries for this user in this date range to prevent duplicates
  // This assumes the import is a full replacement for the month
  const { error: deleteError } = await supabase
    .from('time_entries')
    .delete()
    .eq('user_id', userId)
    .gte('entry_date', minDate)
    .lte('entry_date', maxDate);

  if (deleteError) {
    return { success: false, message: `Fehler beim Löschen alter Einträge: ${deleteError.message}` };
  }

  // Insert new entries
  const { error: insertError } = await supabase
    .from('time_entries')
    .insert(insertPayload);

  if (insertError) {
    return { success: false, message: `Fehler beim Importieren der Zeiterfassungen: ${insertError.message}` };
  }

  revalidatePath('/dashboard');
  return { success: true, message: `${entries.length} Einträge erfolgreich importiert.` };
}

/**
 * Admin action: updates carryover settings for an employee for the current year.
 */
export async function updateCarryOverAction(
  employeeId: string,
  carryOverHours: number,
  carryOverVacationDays: number
): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!callerProfile || (callerProfile.role !== 'COMPANY_ADMIN' && callerProfile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Administratorrechte.' };
  }

  const currentYear = new Date().getFullYear();
  
  const { data: existingSettings } = await supabase
    .from('timesheet_settings')
    .select('id')
    .eq('user_id', employeeId)
    .eq('year', currentYear)
    .single();

  if (existingSettings) {
    const { error } = await supabase
      .from('timesheet_settings')
      .update({
        carry_over_hours: carryOverHours,
        carry_over_vacation_days: carryOverVacationDays
      })
      .eq('id', existingSettings.id);

    if (error) return { success: false, message: error.message };
  } else {
    // If no settings exist yet, insert with defaults
    const { error } = await supabase
      .from('timesheet_settings')
      .insert({
        user_id: employeeId,
        year: currentYear,
        carry_over_hours: carryOverHours,
        carry_over_vacation_days: carryOverVacationDays,
        target_hours_monday: 8,
        target_hours_tuesday: 8,
        target_hours_wednesday: 8,
        target_hours_thursday: 8,
        target_hours_friday: 8,
        target_hours_saturday: 0,
        target_hours_sunday: 0,
        vacation_days_entitlement: 30
      });
      
    if (error) return { success: false, message: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Übertrag erfolgreich gespeichert.' };
}

/**
 * Updates the authenticated user's password
 */
export async function updateUserPasswordAction(password: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  
  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Ändern des Passworts') };
  }
  
  return { success: true, message: 'Passwort erfolgreich geändert.' };
}

/**
 * Updates the authenticated user's email address
 */
export async function updateUserEmailAction(email: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  
  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Ändern der E-Mail-Adresse') };
  }
  
  return { success: true, message: 'E-Mail-Adresse erfolgreich geändert. Möglicherweise müssen Sie die neue E-Mail bestätigen.' };
}

/**
 * Sends a password reset email to the user.
 */
export async function resetPasswordAction(formData: FormData): Promise<ActionResponse> {
  const email = formData.get('email') as string;

  if (!email) {
    return { success: false, message: 'Bitte E-Mail eingeben.' };
  }

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/update-password`,
  });

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Senden der E-Mail') };
  }

  return { success: true, message: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet.' };
}

/**
 * Saves an overtime payout for a specific user and month.
 */
export async function saveOvertimePayoutAction(userId: string, year: number, month: number, hours: number, note?: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht autorisiert.' };

  const { data: profile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single();
  if (!profile || (profile.role !== 'COMPANY_ADMIN' && profile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Berechtigung.' };
  }

  const { error } = await supabase.from('overtime_payouts').upsert(
    { user_id: userId, year, month, hours, note },
    { onConflict: 'user_id,year,month' }
  );

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Speichern der Auszahlung') };
  }
  revalidatePath('/dashboard');
  return { success: true, message: 'Auszahlung gespeichert.' };
}

/**
 * Deletes an overtime payout.
 */
export async function deleteOvertimePayoutAction(id: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht autorisiert.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile.role !== 'COMPANY_ADMIN' && profile.role !== 'ROOT')) {
    return { success: false, message: 'Keine Berechtigung.' };
  }

  const { error } = await supabase.from('overtime_payouts').delete().eq('id', id);

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler beim Löschen der Auszahlung') };
  }
  revalidatePath('/dashboard');
  return { success: true, message: 'Auszahlung gelöscht.' };
}
