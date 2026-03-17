-- =============================================================================
-- User-scoped RLS for portfolio (user can only see their own portfolio items)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix portfolio data isolation so each user only sees their own portfolio items
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the portfolio record
-- =============================================================================

BEGIN;

-- Ensure portfolio table has RLS enabled
ALTER TABLE IF EXISTS public.portfolio ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for portfolio
DROP POLICY IF EXISTS portfolio_team_select ON public.portfolio;
DROP POLICY IF EXISTS portfolio_team_insert ON public.portfolio;
DROP POLICY IF EXISTS portfolio_team_update ON public.portfolio;
DROP POLICY IF EXISTS portfolio_team_delete ON public.portfolio;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own portfolio items, and must be approved
CREATE POLICY portfolio_user_select ON public.portfolio
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create portfolio items, auto-assigns to auth.uid(), must be approved
CREATE POLICY portfolio_user_insert ON public.portfolio
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own portfolio items, must be approved
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

-- DELETE: User can only delete their own portfolio items, must be approved
CREATE POLICY portfolio_user_delete ON public.portfolio
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

