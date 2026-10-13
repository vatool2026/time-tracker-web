import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface MobileAuth {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Authenticates a request from the native app via "Authorization: Bearer <Supabase access token>".
 * The returned client runs with the user's JWT, so Row Level Security applies exactly as on the web.
 */
export async function authenticateMobile(request: Request): Promise<MobileAuth | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
