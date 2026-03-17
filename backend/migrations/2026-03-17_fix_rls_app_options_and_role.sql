-- =============================================================================
-- FIX: RLS 42501 error on app_options table
-- Problem 1: get_my_role() reads only from JWT user_metadata claims.
--            If metadata was never synced (e.g. admin created manually),
--            is_admin() returns false → all writes blocked with 42501.
-- Problem 2: app_options only has an admin-only policy. Approved employees
--            also need to read and write app_options (e.g. adding categories
--            from dropdown forms).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fix 1: Make get_my_role() fall back to public.users table when JWT claim
--        is missing or stale. SECURITY DEFINER bypasses RLS safely.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Primary: read from JWT claim (fast, no DB hit)
    NULLIF(TRIM((auth.jwt() ->> 'user_metadata')::jsonb->>'role'), ''),
    -- Fallback: read directly from users table (handles missing/stale JWT)
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$;

-- Refresh dependent helpers so they pick up the new get_my_role()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.get_my_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Primary: JWT claim
    NULLIF(TRIM((auth.jwt() ->> 'user_metadata')::jsonb->>'approved'), '')::boolean,
    -- Fallback: users table
    (SELECT approved FROM public.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_employee_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_my_role() = 'employee' AND public.get_my_approved() = true,
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Fix 2: Sync JWT metadata for ALL existing users right now so future logins
--        have correct role/approved claims immediately.
-- -----------------------------------------------------------------------------

UPDATE auth.users au
SET raw_user_meta_data = jsonb_build_object(
  'name',     pu.name,
  'username', pu.username,
  'phone',    pu.phone,
  'role',     pu.role,
  'approved', pu.approved::text
)
FROM public.users pu
WHERE au.id = pu.id;

-- -----------------------------------------------------------------------------
-- Fix 3: Replace app_options policies.
--        - Any authenticated user can SELECT (needed to load dropdowns)
--        - Any approved user (admin OR employee) can INSERT/UPDATE/DELETE
--          (employees need to add new categories from form dropdowns)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS app_options_admin_all          ON public.app_options;
DROP POLICY IF EXISTS app_options_authenticated_read ON public.app_options;
DROP POLICY IF EXISTS app_options_write              ON public.app_options;

-- Any logged-in user can read app_options (dropdown lists, categories)
CREATE POLICY app_options_authenticated_read
  ON public.app_options
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin has full write access
CREATE POLICY app_options_admin_write
  ON public.app_options
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

-- Approved employees can also insert/update (add new categories from forms)
CREATE POLICY app_options_employee_write
  ON public.app_options
  FOR INSERT
  WITH CHECK (public.is_employee_approved());

CREATE POLICY app_options_employee_update
  ON public.app_options
  FOR UPDATE
  USING      (public.is_employee_approved())
  WITH CHECK (public.is_employee_approved());

-- Only admins can delete (employees cannot remove categories)
-- (already covered by app_options_admin_write FOR ALL above)

