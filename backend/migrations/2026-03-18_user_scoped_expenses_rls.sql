-- =============================================================================
-- User-scoped RLS for expenses (user can only see their own expenses)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix expense data isolation so each user only sees their own expenses
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the expense record
-- =============================================================================

BEGIN;

-- Ensure expenses table has RLS enabled
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for expenses
DROP POLICY IF EXISTS expenses_team_select ON public.expenses;
DROP POLICY IF EXISTS expenses_team_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_team_update ON public.expenses;
DROP POLICY IF EXISTS expenses_team_delete ON public.expenses;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own expenses, and must be approved
CREATE POLICY expenses_user_select ON public.expenses
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create expenses, auto-assigns to auth.uid(), must be approved
CREATE POLICY expenses_user_insert ON public.expenses
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own expenses, must be approved
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

-- DELETE: User can only delete their own expenses, must be approved
CREATE POLICY expenses_user_delete ON public.expenses
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

