-- Add last_login to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;

-- Create a function to sync last_sign_in_at to profiles
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if last_sign_in_at has changed (meaning a login occurred)
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
    UPDATE public.profiles
    SET last_login = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_login();

-- Sync existing data
UPDATE public.profiles p
SET last_login = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id AND u.last_sign_in_at IS NOT NULL;
