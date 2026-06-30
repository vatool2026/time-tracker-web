-- Drop existing tables and types to avoid conflicts during migration
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.timesheet_settings CASCADE;
DROP TABLE IF EXISTS public.category_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS employment_category CASCADE;

-- Create custom types
CREATE TYPE user_role AS ENUM ('ROOT', 'COMPANY_ADMIN', 'EMPLOYEE');
CREATE TYPE employment_category AS ENUM ('FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'AZUBI', 'OTHER');

-- Create Company table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_period_type TEXT DEFAULT 'CALENDAR_MONTH', -- E.g. 'CALENDAR_MONTH', 'CUSTOM_DATE'
  billing_period_start_day INTEGER DEFAULT 1,
  logo_url TEXT,
  feature_urlaub BOOLEAN DEFAULT false,
  feature_abwesenheit BOOLEAN DEFAULT false,
  feature_sonstiges BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create User profile table linked to Supabase Auth
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role DEFAULT 'EMPLOYEE',
  employment_category employment_category DEFAULT 'FULLTIME',
  employee_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create Category Settings (Zuschlags-Logik)
CREATE TABLE public.category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category employment_category NOT NULL,
  night_surcharge_start_time TIME DEFAULT '22:00:00',
  night_surcharge_end_time TIME DEFAULT '06:00:00',
  night_surcharge_rate DECIMAL DEFAULT 25.0, -- Percentage
  sunday_surcharge_rate DECIMAL DEFAULT 50.0, -- Percentage
  holiday_surcharge_rate DECIMAL DEFAULT 100.0, -- Percentage
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, category)
);

-- Create Timesheet Settings (User specific)
CREATE TABLE public.timesheet_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  carry_over_hours DECIMAL DEFAULT 0.0,
  vacation_days_entitlement DECIMAL DEFAULT 30.0,
  carry_over_vacation_days DECIMAL DEFAULT 0.0,
  target_hours_monday DECIMAL DEFAULT 8.0,
  target_hours_tuesday DECIMAL DEFAULT 8.0,
  target_hours_wednesday DECIMAL DEFAULT 8.0,
  target_hours_thursday DECIMAL DEFAULT 8.0,
  target_hours_friday DECIMAL DEFAULT 8.0,
  target_hours_saturday DECIMAL DEFAULT 0.0,
  target_hours_sunday DECIMAL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, year)
);

-- Create Time Entry table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  absence_code TEXT, -- e.g., 'U' (Urlaub), 'K' (Krank)
  note TEXT,
  edit_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS (Policies can be added later)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Security Definer Functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql;

-- RLS Policies

-- 1. Companies Policies
CREATE POLICY "Allow public insert on companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to view own company" ON public.companies FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR id = public.get_user_company_id());
CREATE POLICY "Allow admin to update own company" ON public.companies FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND id = public.get_user_company_id()));
CREATE POLICY "Allow root to delete companies" ON public.companies FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT');

-- 2. Profiles Policies
CREATE POLICY "Allow public insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to view profiles in same company" ON public.profiles FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR company_id = public.get_user_company_id());
CREATE POLICY "Allow users to update own profile or admin to update company profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));
CREATE POLICY "Allow root to delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT');

-- 3. Category Settings Policies
CREATE POLICY "Allow users to view category settings" ON public.category_settings FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR company_id = public.get_user_company_id());
CREATE POLICY "Allow admin to update category settings" ON public.category_settings FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));
CREATE POLICY "Allow admin to delete category settings" ON public.category_settings FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id()));
CREATE POLICY "Allow public insert on category_settings" ON public.category_settings FOR INSERT WITH CHECK (true);

-- 4. Timesheet Settings Policies
CREATE POLICY "Allow users to view own timesheet settings or admin to view company settings" ON public.timesheet_settings FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow public insert on timesheet_settings" ON public.timesheet_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users or admin to update timesheet settings" ON public.timesheet_settings FOR UPDATE TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow admin to delete timesheet settings" ON public.timesheet_settings FOR DELETE TO authenticated USING (public.get_user_role() = 'ROOT' OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));

-- 5. Time Entries Policies
CREATE POLICY "Allow users to view own time entries or admin to view company entries" ON public.time_entries FOR SELECT TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
CREATE POLICY "Allow users to insert own time entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'ROOT' OR user_id = auth.uid());
CREATE POLICY "Allow users or admins to update or delete time entries" ON public.time_entries FOR ALL TO authenticated USING (public.get_user_role() = 'ROOT' OR user_id = auth.uid() OR (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id()));
