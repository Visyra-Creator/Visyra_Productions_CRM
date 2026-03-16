-- =============================================================================
-- Update handle_new_user trigger to sync role + approved to auth.users metadata
-- This ensures role and approved are available in auth.jwt() for RLS policies
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    username,
    phone,
    role,
    approved
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'employee',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Sync role + approved to auth metadata so JWT contains these values
  -- (required for RLS policies that use auth.jwt())
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'name',     COALESCE(raw_user_meta_data->>'name', ''),
    'username', COALESCE(NULLIF(raw_user_meta_data->>'username', ''), email),
    'phone',    COALESCE(raw_user_meta_data->>'phone', ''),
    'role',     'employee',
    'approved', 'false'
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Create a function to update JWT metadata when role/approved changes
-- This must be called by a trigger on public.users UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_metadata_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update auth.users metadata to reflect changes to role/approved in public.users
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'name',     NEW.name,
    'username', NEW.username,
    'phone',    NEW.phone,
    'role',     NEW.role,
    'approved', NEW.approved::text
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Trigger to sync whenever role or approved changes
DROP TRIGGER IF EXISTS sync_user_metadata_on_update ON public.users;
CREATE TRIGGER sync_user_metadata_on_update
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.approved IS DISTINCT FROM NEW.approved)
  EXECUTE FUNCTION public.sync_user_metadata_to_auth();

