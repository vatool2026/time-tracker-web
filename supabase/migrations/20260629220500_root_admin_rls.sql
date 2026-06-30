-- Drop old policies
DROP POLICY IF EXISTS "Allow users to view own company" ON public.companies;
DROP POLICY IF EXISTS "Allow admin to update own company" ON public.companies;

DROP POLICY IF EXISTS "Allow users to view profiles in same company" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile or admin to update company profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow users to view category settings" ON public.category_settings;
DROP POLICY IF EXISTS "Allow admin to update category settings" ON public.category_settings;
DROP POLICY IF EXISTS "Allow admin to delete category settings" ON public.category_settings;

DROP POLICY IF EXISTS "Allow users to view own timesheet settings or admin to view company settings" ON public.timesheet_settings;
DROP POLICY IF EXISTS "Allow users or admin to update timesheet settings" ON public.timesheet_settings;
DROP POLICY IF EXISTS "Allow admin to delete timesheet settings" ON public.timesheet_settings;

DROP POLICY IF EXISTS "Allow users to view own time entries or admin to view company entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow users to insert own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow users or admins to update or delete time entries" ON public.time_entries;


-- Create new policies with ROOT bypass

-- 1. Companies
CREATE POLICY "Allow users to view own company" ON public.companies FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR id = public.get_user_company_id());
CREATE POLICY "Allow admin to update own company" ON public.companies FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND id = public.get_user_company_id()));
CREATE POLICY "Allow root to delete companies" ON public.companies FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT');

-- 2. Profiles
CREATE POLICY "Allow users to view profiles in same company" ON public.profiles FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR company_id = public.get_user_company_id());
CREATE POLICY "Allow users to update own profile or admin to update company profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));
CREATE POLICY "Allow root to delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT');

-- 3. Category Settings
CREATE POLICY "Allow users to view category settings" ON public.category_settings FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR company_id = public.get_user_company_id());
CREATE POLICY "Allow admin to update category settings" ON public.category_settings FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));
CREATE POLICY "Allow admin to delete category settings" ON public.category_settings FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));

-- 4. Timesheet Settings
CREATE POLICY "Allow users to view own timesheet settings or admin to view company settings" ON public.timesheet_settings FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow users or admin to update timesheet settings" ON public.timesheet_settings FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow admin to delete timesheet settings" ON public.timesheet_settings FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));

-- 5. Time Entries
CREATE POLICY "Allow users to view own time entries or admin to view company entries" ON public.time_entries FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow users to insert own time entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'ROOT' OR user_id = auth.uid());
CREATE POLICY "Allow users or admins to update or delete time entries" ON public.time_entries FOR ALL TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
