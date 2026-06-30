"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function getAllCompaniesAction(): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const { data: companies, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, message: error.message };

  return { success: true, message: 'Unternehmen geladen', data: companies };
}

export async function getAllProfilesAction(): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const { data: profiles, error } = await supabase.from('profiles').select('*, companies(name)').order('created_at', { ascending: false });
  if (error) return { success: false, message: error.message };

  return { success: true, message: 'Profile geladen', data: profiles };
}

export async function deleteCompanyAction(companyId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const { error } = await supabase.from('companies').delete().eq('id', companyId);
  if (error) return { success: false, message: error.message };

  revalidatePath('/root');
  return { success: true, message: 'Unternehmen erfolgreich gelöscht.' };
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function deleteProfileAction(profileId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  if (profileId === user.id) return { success: false, message: 'Du kannst dich nicht selbst löschen' };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
     return { success: false, message: 'Serverkonfiguration: SUPABASE_SERVICE_ROLE_KEY fehlt.' };
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await adminClient.auth.admin.deleteUser(profileId);
  if (error) return { success: false, message: error.message };

  revalidatePath('/root');
  return { success: true, message: 'Benutzerprofil erfolgreich gelöscht.' };
}

export async function updateCompanyAction(companyId: string, updates: { name?: string; feature_urlaub?: boolean; feature_abwesenheit?: boolean; feature_sonstiges?: boolean }): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const { error } = await supabase.from('companies').update(updates).eq('id', companyId);
  if (error) return { success: false, message: error.message };

  revalidatePath('/root');
  return { success: true, message: 'Unternehmen aktualisiert.' };
}

export async function updateProfileAction(profileId: string, updates: any): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId);
  if (error) return { success: false, message: error.message };

  revalidatePath('/root');
  return { success: true, message: 'Profil aktualisiert.' };
}

export async function resetUserPasswordAction(profileId: string, newPassword: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { success: false, message: 'Serverkonfiguration fehlerhaft.' };

  const adminClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { error } = await adminClient.auth.admin.updateUserById(profileId, { password: newPassword });
  if (error) return { success: false, message: error.message };

  return { success: true, message: 'Passwort erfolgreich zurückgesetzt.' };
}

export async function toggleUserLockAction(profileId: string, lock: boolean): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Nicht authentifiziert' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'ROOT') return { success: false, message: 'Keine Berechtigung' };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { success: false, message: 'Serverkonfiguration fehlerhaft.' };

  const adminClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Update auth block
  const banDuration = lock ? '876000h' : 'none';
  const { error: authError } = await adminClient.auth.admin.updateUserById(profileId, { ban_duration: banDuration });
  if (authError) return { success: false, message: authError.message };

  // Update profile
  const { error: profileError } = await supabase.from('profiles').update({ is_locked: lock }).eq('id', profileId);
  if (profileError) return { success: false, message: profileError.message };

  revalidatePath('/root');
  return { success: true, message: lock ? 'Benutzer gesperrt.' : 'Benutzer entsperrt.' };
}
