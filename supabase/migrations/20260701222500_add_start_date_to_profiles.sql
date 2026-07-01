-- Migration to add start_date (Eintrittsdatum) to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS start_date DATE;
