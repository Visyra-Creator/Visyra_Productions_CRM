-- =============================================================================
-- Shared Team Access RLS for ALL Business Tables
-- Date: 2026-03-18
--
-- REPLACES all individual user-scoped migrations
-- Security Model:
--   - ALL approved users can see and manage ALL records
--   - Records are NOT filtered by user_id
--   - Admin can create/read/update/delete everything
--   - Approved employees can create/read/update/delete everything
--   - Unapproved users have NO access
--   - When admin adds a record, ALL approved users see it immediately
-- =============================================================================

BEGIN;

-- Drop ALL existing policies on business tables to start fresh
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','leads','shoots','payments','payment_records',
    'expenses','packages','portfolio','locations','location_images'
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

-- Ensure RLS enabled on all business tables
ALTER TABLE IF EXISTS public.clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shoots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_images   ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SHARED ACCESS MODEL: All approved users see all records
-- =============================================================================
-- Helper: Check if current user is approved
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.approved = true
  );
$$;

-- =============================================================================
-- CLIENTS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY clients_approved_select ON public.clients
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY clients_approved_insert ON public.clients
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY clients_approved_update ON public.clients
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY clients_approved_delete ON public.clients
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- LEADS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY leads_approved_select ON public.leads
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY leads_approved_insert ON public.leads
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY leads_approved_update ON public.leads
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY leads_approved_delete ON public.leads
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- SHOOTS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY shoots_approved_select ON public.shoots
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY shoots_approved_insert ON public.shoots
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY shoots_approved_update ON public.shoots
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY shoots_approved_delete ON public.shoots
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- PAYMENTS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY payments_approved_select ON public.payments
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY payments_approved_insert ON public.payments
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY payments_approved_update ON public.payments
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY payments_approved_delete ON public.payments
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- PAYMENT_RECORDS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY payment_records_approved_select ON public.payment_records
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY payment_records_approved_insert ON public.payment_records
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY payment_records_approved_update ON public.payment_records
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY payment_records_approved_delete ON public.payment_records
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- EXPENSES TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY expenses_approved_select ON public.expenses
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY expenses_approved_insert ON public.expenses
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY expenses_approved_update ON public.expenses
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY expenses_approved_delete ON public.expenses
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- PACKAGES TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY packages_approved_select ON public.packages
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY packages_approved_insert ON public.packages
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY packages_approved_update ON public.packages
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY packages_approved_delete ON public.packages
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- PORTFOLIO TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY portfolio_approved_select ON public.portfolio
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY portfolio_approved_insert ON public.portfolio
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY portfolio_approved_update ON public.portfolio
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY portfolio_approved_delete ON public.portfolio
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- LOCATIONS TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY locations_approved_select ON public.locations
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY locations_approved_insert ON public.locations
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY locations_approved_update ON public.locations
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY locations_approved_delete ON public.locations
  FOR DELETE
  USING (public.is_approved_user());

-- =============================================================================
-- LOCATION_IMAGES TABLE POLICIES - Shared access for approved users
-- =============================================================================

CREATE POLICY location_images_approved_select ON public.location_images
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY location_images_approved_insert ON public.location_images
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY location_images_approved_update ON public.location_images
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY location_images_approved_delete ON public.location_images
  FOR DELETE
  USING (public.is_approved_user());

COMMIT;

