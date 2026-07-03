-- Add state to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS state text DEFAULT 'NW';

-- Add auto_break_deduction_enabled to category_settings
ALTER TABLE public.category_settings 
ADD COLUMN IF NOT EXISTS auto_break_deduction_enabled boolean DEFAULT false;

-- Create company_custom_holidays table
CREATE TABLE IF NOT EXISTS public.company_custom_holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_custom_holidays ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.company_custom_holidays
  FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.company_custom_holidays
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.company_custom_holidays
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.company_custom_holidays
  FOR DELETE
  USING (auth.role() = 'authenticated');
