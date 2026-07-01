CREATE TABLE IF NOT EXISTS public.overtime_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  hours DECIMAL NOT NULL DEFAULT 0.0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, year, month)
);

ALTER TABLE public.overtime_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own payouts or admin to view company payouts" 
  ON public.overtime_payouts FOR SELECT TO authenticated 
  USING (
    public.get_user_role() = 'ROOT' OR 
    user_id = auth.uid() OR 
    (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id())
  );

CREATE POLICY "Allow admin to insert payouts" 
  ON public.overtime_payouts FOR INSERT TO authenticated 
  WITH CHECK (
    public.get_user_role() = 'ROOT' OR 
    (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id())
  );

CREATE POLICY "Allow admin to update payouts" 
  ON public.overtime_payouts FOR UPDATE TO authenticated 
  USING (
    public.get_user_role() = 'ROOT' OR 
    (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id())
  );

CREATE POLICY "Allow admin to delete payouts" 
  ON public.overtime_payouts FOR DELETE TO authenticated 
  USING (
    public.get_user_role() = 'ROOT' OR 
    (public.get_user_role() = 'COMPANY_ADMIN' AND (SELECT company_id FROM public.profiles WHERE id = user_id) = public.get_user_company_id())
  );
