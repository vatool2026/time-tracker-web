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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Monatsabschluss</h1>
      <p className="text-muted-foreground">
        Überprüfen Sie die geleisteten Arbeitsstunden für den abgelaufenen Monat und schließen Sie den Monat für Ihre Mitarbeiter ab.
        Überstunden können in den nächsten Monat übertragen oder ausgezahlt werden.
      </p>

      <MonatsabschlussClient 
        employees={employees || []} 
        company={company} 
        currentUserId={user.id}
      />
    </div>
  );
}
