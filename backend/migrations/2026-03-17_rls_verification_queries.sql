-- =============================================================================
-- RLS Verification & Testing Queries
-- Run these after applying the RLS migration to confirm policies work
-- =============================================================================

-- ===== 1) Verify RLS is enabled on all tables =====

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'users','clients','leads','expenses','payments','payment_records',
    'packages','portfolio','shoots','locations','location_images','app_options'
  )
ORDER BY c.relname;

-- Expected: all rows show rls_enabled = true

-- ===== 2) Verify helper functions exist =====

SELECT
  proname AS function_name,
  prosecdef AS is_security_definer,
  array_agg(pt::text) AS parameter_types
FROM pg_proc
JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
LEFT JOIN (SELECT unnest(proargtypes) AS pt FROM pg_proc) args ON true
WHERE n.nspname = 'public'
  AND proname IN ('get_my_role', 'get_my_approved', 'is_admin', 'is_employee_approved')
GROUP BY pg_proc.oid, proname, prosecdef
ORDER BY proname;

-- Expected: 4 rows, all with prosecdef = true

-- ===== 3) Verify policy existence =====

SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'users','clients','leads','expenses','payments','payment_records',
    'packages','portfolio','shoots','locations','location_images','app_options'
  )
ORDER BY tablename, policyname;

-- Expected:
-- - users: 3 policies (admin_all, employee_read_own, employee_signup_insert)
-- - payments, payment_records, expenses: 1 policy each (admin_all)
-- - clients, leads, packages, portfolio, shoots, locations, location_images: 2 each (admin_all, employee_read)
-- - app_options: 1 policy (admin_all)

-- ===== 4) Verify financial tables are admin-only =====

SELECT
  tablename,
  COUNT(*) AS policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('payments','payment_records','expenses')
GROUP BY tablename
ORDER BY tablename;

-- Expected: each table has exactly 1 policy, and its name contains 'admin_all'

-- ===== 5) Verify users table has no employee update policy =====

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND cmd = 'UPDATE';

-- Expected: 0 rows (no update policies for employees on users table)

-- ===== 6) Check JWT metadata sync triggers exist =====

SELECT
  t.relname AS table_name,
  trg.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger trg
JOIN pg_class t ON t.oid = trg.tgrelid
JOIN pg_proc p ON p.oid = trg.tgfoid
WHERE trg.tgname IN ('on_auth_user_created', 'sync_user_metadata_on_update')
ORDER BY t.relname, trg.tgname;

-- Expected: 2 rows (both triggers should exist)

-- =============================================================================
-- MANUAL TEST: Impersonate user roles and test access
--
-- WARNING: These queries require direct database access. For production,
-- test through your app's API using real authenticated sessions.
--
-- To test with a specific user's JWT claims, use Supabase Edge Functions
-- or test manually by creating test auth users with different roles set
-- in their raw_user_meta_data.
--
-- Example flow:
-- 1. Create test admin: email=admin@test.com, metadata={role:'admin', approved:'true'}
-- 2. Create test employee: email=emp@test.com, metadata={role:'employee', approved:'true'}
-- 3. Create test pending: email=pending@test.com, metadata={role:'employee', approved:'false'}
-- 4. Log in each user in your app
-- 5. Test access to each table (should be blocked/allowed per policy)
-- =============================================================================

-- Verify metadata is being set correctly on new users
SELECT
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Verify public.users has corresponding rows
SELECT
  u.id,
  u.email,
  u.name,
  u.username,
  u.role,
  u.approved,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- Check metadata consistency (auth.users.raw_user_meta_data should match public.users role/approved)
SELECT
  a.id,
  a.email,
  (a.raw_user_meta_data->>'role') AS jwt_role,
  p.role AS db_role,
  (a.raw_user_meta_data->>'approved') AS jwt_approved,
  p.approved AS db_approved,
  CASE
    WHEN (a.raw_user_meta_data->>'role') != p.role THEN 'MISMATCH: role'
    WHEN (a.raw_user_meta_data->>'approved')::text != p.approved::text THEN 'MISMATCH: approved'
    ELSE 'OK'
  END AS status
FROM auth.users a
LEFT JOIN public.users p ON p.id = a.id
ORDER BY a.created_at DESC;

-- Expected: all rows show status='OK' (no mismatches)

