-- Add is_active column to qr_codes
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
