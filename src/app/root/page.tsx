import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import RootDashboard from '@/components/RootDashboard';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'ROOT') {
    // If not root, redirect to normal dashboard
    redirect('/dashboard');
  }

  // Fetch all companies and profiles for the ROOT user
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, companies(name)')
    .order('created_at', { ascending: false });

  return (
    <main className="container" style={{ padding: '0 1.5rem', minHeight: '100vh' }}>
      <RootDashboard 
        companies={companies || []} 
        profiles={profiles || []} 
        rootProfile={profile} 
      />
    </main>
  );
}
