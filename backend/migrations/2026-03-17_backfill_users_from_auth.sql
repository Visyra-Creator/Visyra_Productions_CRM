-- =============================================================================
-- Backfill users table from auth.users
-- Use when public.users is empty or missing rows for existing auth accounts
-- =============================================================================

-- Insert one profile row per auth user that doesn't already have one.
INSERT INTO public.users (
  id,
  email,
  name,
  username,
  phone,
  role,
  approved
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', ''),
  -- Username fallback uses email to satisfy NOT NULL/UNIQUE constraints.
  COALESCE(NULLIF(au.raw_user_meta_data->>'username', ''), au.email),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  'employee',
  false
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND au.email IS NOT NULL;

-- Optional: promote one known user to first admin after backfill.
-- Update the WHERE clause with your admin username OR email.
-- UPDATE public.users
-- SET role = 'admin', approved = true
-- WHERE username = 'admin';
-- -- or
-- -- WHERE email = 'admin@yourdomain.com';

