-- Migration to add address and geofence settings to companies

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL,
ADD COLUMN IF NOT EXISTS longitude DECIMAL,
ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 150;
