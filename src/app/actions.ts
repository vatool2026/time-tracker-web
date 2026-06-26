"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface ActionResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Gets the current date in local YYYY-MM-DD format.
 */
function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the current time in local HH:MM:SS format.
 */
function getLocalTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, message: formatErrorMessage(error, 'Fehler bei der Anmeldung') };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true, message: 'Erfolgreich angemeldet.' };
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
  const categories = ['FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER'];
  const categoryInserts = categories.map(cat => ({
    company_id: companyId,
    category: cat,
    night_surcharge_start_time: '22:00:00',
    night_surcharge_rate: 25.0,
    sunday_surcharge_start_time: '00:00:00',
    sunday_surcharge_rate: 50.0,
    holiday_surcharge_start_time: '00:00:00',
    holiday_surcharge_rate: 100.0,
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
export async function clockInAction(note: string = ''): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const today = getLocalDateString();
  const nowTime = getLocalTimeString();

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
    });

  if (error) return { success: false, message: `Fehler beim Einstempeln: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Erfolgreich eingestempelt.' };
}

/**
 * Clock out: Updates the active entry for today with end_time.
 */
export async function clockOutAction(note: string = ''): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  const nowTime = getLocalTimeString();

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
 * Creates an absence entry (sickness or vacation).
 */
export async function createAbsenceAction(dateStr: string, code: 'U' | 'K', note: string = ''): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert.' };

  // Check if there is already an entry for this date
  const { data: existing } = await supabase
    .from('time_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('entry_date', dateStr);

  if (existing && existing.length > 0) {
    // Delete existing entries for that day to overwrite it with the absence
    const ids = existing.map(e => e.id);
    const { error: deleteError } = await supabase
      .from('time_entries')
      .delete()
      .in('id', ids);

    if (deleteError) return { success: false, message: `Fehler beim Überschreiben des Tages: ${deleteError.message}` };
  }

  // Insert absence entry: start and end time are 00:00:00 for full-day absence
  const { error } = await supabase
    .from('time_entries')
    .insert({
      user_id: user.id,
      entry_date: dateStr,
      start_time: '00:00:00',
      end_time: '00:00:00',
      break_minutes: 0,
      absence_code: code,
      note: note || (code === 'U' ? 'Urlaub' : 'Krankheit'),
    });

  if (error) return { success: false, message: `Fehler beim Eintragen der Abwesenheit: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Abwesenheit erfolgreich eingetragen.' };
}

/**
 * Admin action: updates an employee's profile and timesheet settings.
 */
export async function updateEmployeeSettingsAction(
  employeeId: string,
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE',
  employmentCategory: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER',
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
  }
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
  nightRate: number,
  sundayStart: string,
  sundayRate: number,
  holidayStart: string,
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
      night_surcharge_rate: nightRate,
      sunday_surcharge_start_time: sundayStart,
      sunday_surcharge_rate: sundayRate,
      holiday_surcharge_start_time: holidayStart,
      holiday_surcharge_rate: holidayRate,
    })
    .eq('company_id', callerProfile.company_id)
    .eq('category', category);

  if (error) return { success: false, message: `Fehler beim Aktualisieren der Zuschläge: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Zuschlagsregeln erfolgreich aktualisiert.' };
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
export async function deleteTimeEntryAction(entryId: string): Promise<ActionResponse> {
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
    .delete()
    .eq('id', entryId);

  if (error) return { success: false, message: `Fehler beim Löschen des Eintrags: ${error.message}` };

  revalidatePath('/dashboard');
  return { success: true, message: 'Eintrag erfolgreich gelöscht.' };
}

/**
 * Admin action: Invites a new employee using the Supabase Admin API.
 */
export async function inviteEmployeeAction(
  firstName: string,
  lastName: string,
  email: string,
  role: 'ROOT' | 'COMPANY_ADMIN' | 'EMPLOYEE',
  employmentCategory: 'FULLTIME' | 'PARTTIME' | 'MIDIJOB' | 'MINIJOB' | 'OTHER'
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
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    // Optionally redirect to a specific URL after they click the invite link
    // redirectTo: 'http://localhost:3000/login'
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

