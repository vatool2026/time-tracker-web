"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function rootLoginAction(formData: FormData) {
  const password = formData.get('password') as string;

  if (!password) {
    return { success: false, message: 'Bitte Passwort eingeben.' };
  }

  const supabase = await createClient();

  // Hardcoded root email
  const { error } = await supabase.auth.signInWithPassword({
    email: 'root@system.local',
    password,
  });

  if (error) {
    return { success: false, message: 'Falsches Passwort.' };
  }

  revalidatePath('/root', 'layout');
  return { success: true, message: 'Erfolgreich als Root angemeldet.' };
}
