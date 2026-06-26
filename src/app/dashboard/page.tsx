import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardContainer from '@/components/DashboardContainer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch current user's profile with company details
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // If auth user exists but profile is missing, redirect to login
    redirect('/login');
  }

  const currentYear = new Date().getFullYear();

  // Fetch current user's time entries
  const { data: entries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false });

  // Fetch current user's timesheet settings for the current year
  const { data: timesheetSettings } = await supabase
    .from('timesheet_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', currentYear)
    .maybeSingle();

  // Fetch current user's category surcharge settings
  const { data: surchargeSettings } = await supabase
    .from('category_settings')
    .select('*')
    .eq('company_id', profile.company_id)
    .eq('category', profile.employment_category)
    .maybeSingle();

  // Admin data fetching
  const isAdmin = profile.role === 'COMPANY_ADMIN' || profile.role === 'ROOT';
  let employees = null;
  let allCategorySettings = null;
  let allTimesheetSettings = null;
  let allCompanyEntries = null;

  if (isAdmin) {
    // Fetch all profiles in the same company
    const { data: emps } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('last_name', { ascending: true });

    employees = emps;

    // Fetch all company surcharge settings
    const { data: categorySets } = await supabase
      .from('category_settings')
      .select('*')
      .eq('company_id', profile.company_id);

    allCategorySettings = categorySets;

    // Fetch all timesheet settings of the company employees for current year
    const employeeIds = emps?.map(e => e.id) || [];
    if (employeeIds.length > 0) {
      const { data: tsSets } = await supabase
        .from('timesheet_settings')
        .select('*')
        .eq('year', currentYear)
        .in('user_id', employeeIds);
      
      allTimesheetSettings = tsSets;

      const { data: compEntries } = await supabase
        .from('time_entries')
        .select('*')
        .in('user_id', employeeIds)
        .order('entry_date', { ascending: false });

      allCompanyEntries = compEntries;
    }
  }

  return (
    <main className="container" style={{ padding: '0 1.5rem', minHeight: '100vh' }}>
      <DashboardContainer
        profile={profile}
        entries={entries || []}
        timesheetSettings={timesheetSettings}
        surchargeSettings={surchargeSettings}
        employees={employees}
        allCategorySettings={allCategorySettings}
        allTimesheetSettings={allTimesheetSettings}
        allCompanyEntries={allCompanyEntries}
      />
    </main>
  );
}
