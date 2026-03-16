-- =============================================================================
-- Backfill JWT metadata for existing auth.users
--
-- Run this AFTER applying the updated RLS migration to sync existing users
-- =============================================================================

UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'name',     COALESCE((raw_user_meta_data->>'name'), ''),
  'username', COALESCE(NULLIF(raw_user_meta_data->>'username', ''), email),
  'phone',    COALESCE((raw_user_meta_data->>'phone'), ''),
  'role',     COALESCE((
    SELECT role FROM public.users pu WHERE pu.id = auth.users.id
  ), 'employee'),
  'approved', COALESCE((
    (SELECT approved FROM public.users pu WHERE pu.id = auth.users.id)::text
  ), 'false')
)
WHERE email IS NOT NULL;

-- Verify: check that metadata is now populated
SELECT id, email, raw_user_meta_data
FROM auth.users
LIMIT 5;

