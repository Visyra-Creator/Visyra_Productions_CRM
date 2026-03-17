-- =============================================================================
-- User-scoped RLS for payments (user can only see their own payments)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix payment data isolation so each user only sees their own payments
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the payment record
-- =============================================================================

BEGIN;

-- Ensure payments table has RLS enabled
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for payments
DROP POLICY IF EXISTS payments_team_select ON public.payments;
DROP POLICY IF EXISTS payments_team_insert ON public.payments;
DROP POLICY IF EXISTS payments_team_update ON public.payments;
DROP POLICY IF EXISTS payments_team_delete ON public.payments;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own payments, and must be approved
CREATE POLICY payments_user_select ON public.payments
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create payments, auto-assigns to auth.uid(), must be approved
CREATE POLICY payments_user_insert ON public.payments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own payments, must be approved
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

-- DELETE: User can only delete their own payments, must be approved
CREATE POLICY payments_user_delete ON public.payments
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

