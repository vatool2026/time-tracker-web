-- Migration: add is_minor to profiles
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "is_minor" boolean DEFAULT false;
