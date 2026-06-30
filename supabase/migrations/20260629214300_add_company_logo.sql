-- Add logo_url to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create logos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for logos bucket
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Authenticated admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'COMPANY_ADMIN'
);

CREATE POLICY "Authenticated admins can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'COMPANY_ADMIN'
);

CREATE POLICY "Authenticated admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'COMPANY_ADMIN'
);
