-- =============================================================================
-- User-scoped RLS for shoots (user can only see their own shoots)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix shoot data isolation so each user only sees their own shoots
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the shoot record
-- =============================================================================

BEGIN;

-- Ensure shoots table has RLS enabled
ALTER TABLE IF EXISTS public.shoots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for shoots
DROP POLICY IF EXISTS shoots_team_select ON public.shoots;
DROP POLICY IF EXISTS shoots_team_insert ON public.shoots;
DROP POLICY IF EXISTS shoots_team_update ON public.shoots;
DROP POLICY IF EXISTS shoots_team_delete ON public.shoots;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own shoots, and must be approved
CREATE POLICY shoots_user_select ON public.shoots
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create shoots, auto-assigns to auth.uid(), must be approved
CREATE POLICY shoots_user_insert ON public.shoots
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own shoots, must be approved
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

-- DELETE: User can only delete their own shoots, must be approved
CREATE POLICY shoots_user_delete ON public.shoots
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

