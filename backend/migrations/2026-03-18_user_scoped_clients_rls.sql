-- =============================================================================
-- User-scoped RLS for clients (user can only see their own clients)
-- Date: 2026-03-18
--
-- Goal:
--   - Fix client data isolation so each user only sees their own clients
--   - Keep approval check for authentication layer
--   - User MUST be approved AND own the client record
-- =============================================================================

BEGIN;

-- Ensure clients table has RLS enabled
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for clients
DROP POLICY IF EXISTS clients_team_select ON public.clients;
DROP POLICY IF EXISTS clients_team_insert ON public.clients;
DROP POLICY IF EXISTS clients_team_update ON public.clients;
DROP POLICY IF EXISTS clients_team_delete ON public.clients;

-- CREATE NEW POLICIES: User-scoped (user_id = auth.uid()) AND approved

-- SELECT: User can see only their own clients, and must be approved
CREATE POLICY clients_user_select ON public.clients
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- INSERT: User can create clients, auto-assigns to auth.uid(), must be approved
CREATE POLICY clients_user_insert ON public.clients
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

-- UPDATE: User can only update their own clients, must be approved
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

-- DELETE: User can only delete their own clients, must be approved
CREATE POLICY clients_user_delete ON public.clients
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.approved = true
    )
  );

COMMIT;

