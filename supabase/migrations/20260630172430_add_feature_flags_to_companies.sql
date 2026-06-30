ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS feature_urlaub BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_abwesenheit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_sonstiges BOOLEAN DEFAULT false;
