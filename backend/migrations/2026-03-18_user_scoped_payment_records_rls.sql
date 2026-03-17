-- =============================================================================
-- User-scoped RLS for payment_records (user can only see their own payment records)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix payment record data isolation so each user only sees their own payment records
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the payment record
-- =============================================================================

BEGIN;

-- Ensure payment_records table has RLS enabled
ALTER TABLE IF EXISTS public.payment_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for payment_records
DROP POLICY IF EXISTS payment_records_team_select ON public.payment_records;
DROP POLICY IF EXISTS payment_records_team_insert ON public.payment_records;
DROP POLICY IF EXISTS payment_records_team_update ON public.payment_records;
DROP POLICY IF EXISTS payment_records_team_delete ON public.payment_records;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own payment records, and must be approved
CREATE POLICY payment_records_user_select ON public.payment_records
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create payment records, auto-assigns to auth.uid(), must be approved
CREATE POLICY payment_records_user_insert ON public.payment_records
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own payment records, must be approved
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

-- DELETE: User can only delete their own payment records, must be approved
CREATE POLICY payment_records_user_delete ON public.payment_records
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

