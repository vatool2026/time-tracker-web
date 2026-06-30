-- Create absence_codes table
CREATE TABLE public.absence_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employment_category employment_category NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  factor DECIMAL NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, employment_category, code)
);

-- Enable RLS
ALTER TABLE public.absence_codes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow users to view absence codes in same company" 
  ON public.absence_codes FOR SELECT 
  TO authenticated 
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Allow admin to manage absence codes" 
  ON public.absence_codes FOR ALL 
  TO authenticated 
  USING (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id());

CREATE POLICY "Allow public insert on absence_codes" 
  ON public.absence_codes FOR INSERT 
  WITH CHECK (true);
