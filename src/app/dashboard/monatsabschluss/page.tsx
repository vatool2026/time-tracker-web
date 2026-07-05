import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import MonatsabschlussClient from './MonatsabschlussClient';
import { getMonthlyBalancesAction } from '@/app/actions';

export default async function MonatsabschlussPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'COMPANY_ADMIN' && profile.role !== 'ROOT')) {
    redirect('/dashboard');
  }

  // Load employees
  const { data: employees } = await supabase
    .from('profiles')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('last_name', { ascending: true });

  const company = profile.companies;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Monatsabschluss</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Überprüfen Sie die geleisteten Arbeitsstunden für den abgelaufenen Monat und schließen Sie den Monat für Ihre Mitarbeiter ab.
          Überstunden können in den nächsten Monat übertragen oder ausgezahlt werden.
        </p>
      </div>

      <MonatsabschlussClient 
        employees={employees || []} 
        company={company} 
        currentUserId={user.id}
      />
    </div>
  );
}
