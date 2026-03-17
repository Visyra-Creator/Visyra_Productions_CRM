-- =============================================================================
-- User-scoped RLS for leads (user can only see their own leads)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix lead data isolation so each user only sees their own leads
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the lead record
-- =============================================================================

BEGIN;

-- Ensure leads table has RLS enabled
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for leads
DROP POLICY IF EXISTS leads_team_select ON public.leads;
DROP POLICY IF EXISTS leads_team_insert ON public.leads;
DROP POLICY IF EXISTS leads_team_update ON public.leads;
DROP POLICY IF EXISTS leads_team_delete ON public.leads;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own leads, and must be approved
CREATE POLICY leads_user_select ON public.leads
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create leads, auto-assigns to auth.uid(), must be approved
CREATE POLICY leads_user_insert ON public.leads
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own leads, must be approved
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

-- DELETE: User can only delete their own leads, must be approved
CREATE POLICY leads_user_delete ON public.leads
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

