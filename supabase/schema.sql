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
CREATE TYPE employment_category AS ENUM ('FULLTIME', 'PARTTIME', 'MIDIJOB', 'MINIJOB', 'OTHER');

-- Create Company table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_period_type TEXT DEFAULT 'CALENDAR_MONTH', -- E.g. 'CALENDAR_MONTH', 'CUSTOM_DATE'
  billing_period_start_day INTEGER DEFAULT 1,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create Category Settings (Zuschlags-Logik)
CREATE TABLE public.category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category employment_category NOT NULL,
  night_surcharge_start_time TIME DEFAULT '22:00:00',
  night_surcharge_rate DECIMAL DEFAULT 25.0, -- Percentage
  sunday_surcharge_start_time TIME DEFAULT '00:00:00',
  sunday_surcharge_rate DECIMAL DEFAULT 50.0,
  holiday_surcharge_start_time TIME DEFAULT '00:00:00',
  holiday_surcharge_rate DECIMAL DEFAULT 100.0,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS (Policies can be added later)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
