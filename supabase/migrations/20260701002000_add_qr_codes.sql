-- Add feature flag to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS feature_qr_tracking BOOLEAN DEFAULT false;

-- Create QR Codes table
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for QR Codes
DROP POLICY IF EXISTS "Allow public insert on qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Allow users to view qr_codes in same company" ON public.qr_codes;
DROP POLICY IF EXISTS "Allow admin to update qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "Allow admin to delete qr_codes" ON public.qr_codes;

CREATE POLICY "Allow public insert on qr_codes" ON public.qr_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to view qr_codes in same company" ON public.qr_codes FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "Allow admin to update qr_codes" ON public.qr_codes FOR UPDATE TO authenticated USING (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id());
CREATE POLICY "Allow admin to delete qr_codes" ON public.qr_codes FOR DELETE TO authenticated USING (public.get_user_role() = 'COMPANY_ADMIN' AND company_id = public.get_user_company_id());

-- Add qr_code_id to time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL;
