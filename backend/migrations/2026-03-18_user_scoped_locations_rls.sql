-- =============================================================================
-- User-scoped RLS for locations (user can only see their own locations)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix location data isolation so each user only sees their own locations
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the location record
-- =============================================================================

BEGIN;

-- Ensure locations table has RLS enabled
ALTER TABLE IF EXISTS public.locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for locations
DROP POLICY IF EXISTS locations_team_select ON public.locations;
DROP POLICY IF EXISTS locations_team_insert ON public.locations;
DROP POLICY IF EXISTS locations_team_update ON public.locations;
DROP POLICY IF EXISTS locations_team_delete ON public.locations;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own locations, and must be approved
CREATE POLICY locations_user_select ON public.locations
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create locations, auto-assigns to auth.uid(), must be approved
CREATE POLICY locations_user_insert ON public.locations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own locations, must be approved
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

-- DELETE: User can only delete their own locations, must be approved
CREATE POLICY locations_user_delete ON public.locations
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

