-- =============================================================================
-- AUDIT FIX: Supabase Auth & Users Table
-- Date: 2026-03-17
-- Run this in Supabase SQL Editor (replaces previous policy migration)
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE users TABLE (was never created in any prior migration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL DEFAULT '',
  username    text        NOT NULL UNIQUE,
  phone       text        NOT NULL DEFAULT '',
  email       text        NOT NULL UNIQUE,
  role        text        NOT NULL DEFAULT 'employee'
                          CHECK (role IN ('admin', 'employee')),    -- ✅ constrained values only
  approved    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast pending-approval queries (used in employees screen)
CREATE INDEX IF NOT EXISTS idx_users_approved  ON public.users(approved);
CREATE INDEX IF NOT EXISTS idx_users_role      ON public.users(role);

-- =============================================================================
-- STEP 2: updated_at auto-maintenance trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- STEP 3: SECURITY DEFINER helper — avoids RLS recursion in policies
--
-- PROBLEM: policies that check role by querying public.users trigger RLS again,
-- causing infinite recursion.
--
-- FIX: a SECURITY DEFINER function bypasses RLS and reads the role directly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER                  -- ✅ bypasses RLS; safe because it only
SET search_path = public           --    exposes the caller's own role
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- =============================================================================
-- STEP 4: DROP all old policies before recreating them cleanly
-- =============================================================================

DROP POLICY IF EXISTS "admins_read_all_users"          ON public.users;
DROP POLICY IF EXISTS "employees_read_own_record"      ON public.users;
DROP POLICY IF EXISTS "admins_update_approved_field"   ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile"       ON public.users;
DROP POLICY IF EXISTS "admins_create_users"            ON public.users;
DROP POLICY IF EXISTS "system_create_employees"        ON public.users;
DROP POLICY IF EXISTS "admins_delete_users"            ON public.users;

-- =============================================================================
-- STEP 5: Enable RLS
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 6: SELECT policies
-- =============================================================================

-- Admins can read every row
CREATE POLICY "admins_read_all_users"
  ON public.users
  FOR SELECT
  USING ( public.get_my_role() = 'admin' );  -- ✅ no recursion

-- Every user can read their own row
CREATE POLICY "users_read_own_record"
  ON public.users
  FOR SELECT
  USING ( id = auth.uid() );

-- =============================================================================
-- STEP 7: UPDATE policies
-- =============================================================================

-- Only admins can change ANY column (including approved and role)
CREATE POLICY "admins_update_any_user"
  ON public.users
  FOR UPDATE
  USING  ( public.get_my_role() = 'admin' )
  WITH CHECK ( public.get_my_role() = 'admin' );

-- Employees can update their own non-sensitive fields only.
-- role and approved are locked via WITH CHECK.
-- ✅ Uses get_my_role() instead of subquery to avoid recursion.
CREATE POLICY "users_update_own_profile"
  ON public.users
  FOR UPDATE
  USING ( id = auth.uid() )
  WITH CHECK (
    id       = auth.uid()
    AND role     = public.get_my_role()     -- ✅ cannot escalate role
    AND approved = (
          SELECT approved FROM public.users
          WHERE id = auth.uid()             -- approved read via own-record SELECT policy
        )
  );

-- =============================================================================
-- STEP 8: INSERT policies
-- =============================================================================

-- FIX: old "system_create_employees" had NO auth.uid() = id check,
-- meaning anyone could insert arbitrary rows.
-- New policy requires the inserted id to match the caller's auth uid.
CREATE POLICY "users_insert_own_record"
  ON public.users
  FOR INSERT
  WITH CHECK (
    id       = auth.uid()                   -- ✅ can only insert their own row
    AND role     = 'employee'               -- ✅ cannot self-assign admin
    AND approved = false                    -- ✅ cannot self-approve
  );

-- Admins can insert rows on behalf of others (e.g. manual user creation)
CREATE POLICY "admins_insert_any_user"
  ON public.users
  FOR INSERT
  WITH CHECK ( public.get_my_role() = 'admin' );

-- =============================================================================
-- STEP 9: DELETE policies
-- =============================================================================

-- Only admins can delete users
CREATE POLICY "admins_delete_users"
  ON public.users
  FOR DELETE
  USING ( public.get_my_role() = 'admin' );

-- =============================================================================
-- STEP 10: Fix the signup trigger
--
-- PROBLEMS in old trigger:
--   1. username was set to NEW.email instead of reading from metadata
--   2. name and phone were never inserted
--   3. No handling of NULL metadata values
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER                          -- ✅ bypasses RLS so trigger can insert
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
    COALESCE(NEW.raw_user_meta_data->>'name',     ''),   -- ✅ reads from signup metadata
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), -- fallback to email if absent
    COALESCE(NEW.raw_user_meta_data->>'phone',    ''),   -- ✅ reads from signup metadata
    'employee',                                          -- ✅ always starts as employee
    false                                                -- ✅ always starts unapproved
  )
  ON CONFLICT (id) DO NOTHING;            -- ✅ safe if app also does a manual insert
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

