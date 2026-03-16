-- =============================================================================
-- RLS hardening for CRM tables
-- Date: 2026-03-17
--
-- Tables covered:
--   users, clients, leads, expenses, payments, payment_records,
--   packages, portfolio, shoots, locations, location_images, app_options
--
-- Security model:
--   - Admin: full access to all tables
--   - Employee: read-only access to selected non-financial tables
--   - Employee: users table = read own profile only
--   - Financial tables (payments, payment_records, expenses): admin-only
--
-- NOTE: Helper functions use auth.jwt() to avoid RLS recursion.
--       Role and approved status must be stored in JWT claims (auth.jwt() ->> 'user_metadata')
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Helper auth functions (use auth.jwt() to avoid RLS recursion)
-- -----------------------------------------------------------------------------

-- Get user's role from JWT claims (set during signup/auth)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'user_metadata')::jsonb->>'role';
$$;

-- Get user's approved status from JWT claims
CREATE OR REPLACE FUNCTION public.get_my_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'user_metadata')::jsonb->>'approved' = 'true', false);
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() = 'admin', false);
$$;

-- Check if user is approved employee
CREATE OR REPLACE FUNCTION public.is_employee_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() = 'employee' AND public.get_my_approved() = true, false);
$$;

-- -----------------------------------------------------------------------------
-- 2) Enable RLS on all target tables
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.packages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shoots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_options     ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3) Remove existing policies on these tables (idempotent reset)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','clients','leads','expenses','payments','payment_records',
    'packages','portfolio','shoots','locations','location_images','app_options'
  ]
  LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4) users table policies
-- -----------------------------------------------------------------------------

-- NOTE: Users table policies deliberately lenient for self-access
-- because not all users may have JWT metadata set yet.

-- ALL users can read their own record (no JWT check needed)
CREATE POLICY users_read_own_always
  ON public.users
  FOR SELECT
  USING (id = auth.uid());

-- Admin can read ALL users (with JWT check)
CREATE POLICY users_admin_read_all
  ON public.users
  FOR SELECT
  USING (public.is_admin());

-- Admin can update/delete any user (with JWT check)
CREATE POLICY users_admin_write
  ON public.users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY users_admin_delete
  ON public.users
  FOR DELETE
  USING (public.is_admin());

-- Employees can self-update ONLY non-sensitive fields (name, phone, username)
-- Cannot update role or approved via trigger/constraint
CREATE POLICY users_employee_update_own
  ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    AND public.is_employee_approved()
  )
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())    -- cannot change role
    AND approved = (SELECT approved FROM public.users WHERE id = auth.uid())  -- cannot change approved
  );

-- Signup insert (employee only, self-insert)
CREATE POLICY users_insert_on_signup
  ON public.users
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'employee'
    AND approved = false
  );


-- -----------------------------------------------------------------------------
-- 5) Admin-only financial tables
-- -----------------------------------------------------------------------------

CREATE POLICY payments_admin_all
  ON public.payments
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY payment_records_admin_all
  ON public.payment_records
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY expenses_admin_all
  ON public.expenses
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6) Non-financial tables: admin full + employee read-only
-- -----------------------------------------------------------------------------

-- clients
CREATE POLICY clients_admin_all
  ON public.clients
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY clients_employee_read
  ON public.clients
  FOR SELECT
  USING (public.is_employee_approved());

-- leads
CREATE POLICY leads_admin_all
  ON public.leads
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY leads_employee_read
  ON public.leads
  FOR SELECT
  USING (public.is_employee_approved());

-- packages
CREATE POLICY packages_admin_all
  ON public.packages
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY packages_employee_read
  ON public.packages
  FOR SELECT
  USING (public.is_employee_approved());

-- portfolio
CREATE POLICY portfolio_admin_all
  ON public.portfolio
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY portfolio_employee_read
  ON public.portfolio
  FOR SELECT
  USING (public.is_employee_approved());

-- shoots
CREATE POLICY shoots_admin_all
  ON public.shoots
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY shoots_employee_read
  ON public.shoots
  FOR SELECT
  USING (public.is_employee_approved());

-- locations
CREATE POLICY locations_admin_all
  ON public.locations
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY locations_employee_read
  ON public.locations
  FOR SELECT
  USING (public.is_employee_approved());

-- location_images
CREATE POLICY location_images_admin_all
  ON public.location_images
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY location_images_employee_read
  ON public.location_images
  FOR SELECT
  USING (public.is_employee_approved());

-- -----------------------------------------------------------------------------
-- 7) app_options: admin-only (modify/read)
-- -----------------------------------------------------------------------------

CREATE POLICY app_options_admin_all
  ON public.app_options
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

