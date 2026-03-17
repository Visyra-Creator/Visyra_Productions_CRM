-- =============================================================================
-- Consolidated User-Scoped RLS for ALL Business Tables
-- Date: 2026-03-18 (FINAL CONSOLIDATED VERSION)
--
-- This migration REPLACES all individual user-scoped migrations
-- It provides a complete, unified RLS policy set for all tables
--
-- Security Model:
--   - Each user sees ONLY their own records (user_id = auth.uid())
--   - User MUST be approved (users.approved = true)
--   - Admin can manage their own records like any other user
--   - No cross-user team access (pure user-scoped isolation)
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
-- CLIENTS TABLE POLICIES
-- =============================================================================

CREATE POLICY clients_user_select ON public.clients
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY clients_user_insert ON public.clients
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY clients_user_update ON public.clients
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY clients_user_delete ON public.clients
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- LEADS TABLE POLICIES
-- =============================================================================

CREATE POLICY leads_user_select ON public.leads
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY leads_user_insert ON public.leads
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY leads_user_update ON public.leads
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY leads_user_delete ON public.leads
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- SHOOTS TABLE POLICIES
-- =============================================================================

CREATE POLICY shoots_user_select ON public.shoots
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY shoots_user_insert ON public.shoots
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY shoots_user_update ON public.shoots
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY shoots_user_delete ON public.shoots
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- PAYMENTS TABLE POLICIES
-- =============================================================================

CREATE POLICY payments_user_select ON public.payments
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payments_user_insert ON public.payments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payments_user_update ON public.payments
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payments_user_delete ON public.payments
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- PAYMENT_RECORDS TABLE POLICIES
-- =============================================================================

CREATE POLICY payment_records_user_select ON public.payment_records
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payment_records_user_insert ON public.payment_records
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payment_records_user_update ON public.payment_records
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY payment_records_user_delete ON public.payment_records
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- EXPENSES TABLE POLICIES
-- =============================================================================

CREATE POLICY expenses_user_select ON public.expenses
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY expenses_user_insert ON public.expenses
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY expenses_user_update ON public.expenses
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY expenses_user_delete ON public.expenses
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- PACKAGES TABLE POLICIES
-- =============================================================================

CREATE POLICY packages_user_select ON public.packages
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY packages_user_insert ON public.packages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY packages_user_update ON public.packages
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY packages_user_delete ON public.packages
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- PORTFOLIO TABLE POLICIES
-- =============================================================================

CREATE POLICY portfolio_user_select ON public.portfolio
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY portfolio_user_insert ON public.portfolio
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY portfolio_user_update ON public.portfolio
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY portfolio_user_delete ON public.portfolio
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- LOCATIONS TABLE POLICIES
-- =============================================================================

CREATE POLICY locations_user_select ON public.locations
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY locations_user_insert ON public.locations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY locations_user_update ON public.locations
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY locations_user_delete ON public.locations
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- =============================================================================
-- LOCATION_IMAGES TABLE POLICIES
-- =============================================================================

CREATE POLICY location_images_user_select ON public.location_images
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY location_images_user_insert ON public.location_images
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY location_images_user_update ON public.location_images
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

CREATE POLICY location_images_user_delete ON public.location_images
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

