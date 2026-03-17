-- =============================================================================
-- Shared team access for leads table (admin + approved employees)
-- Date: 2026-03-18
--
-- Goal:
--   - Allow different signed-in accounts from the same CRM team to share leads
--   - Keep auth required and approval-gated access
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.approved = true
  );
$$;

ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', p.policyname);
  END LOOP;
END $$;

CREATE POLICY leads_team_select
  ON public.leads
  FOR SELECT
  USING (public.is_approved_user());

CREATE POLICY leads_team_insert
  ON public.leads
  FOR INSERT
  WITH CHECK (public.is_approved_user());

CREATE POLICY leads_team_update
  ON public.leads
  FOR UPDATE
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

CREATE POLICY leads_team_delete
  ON public.leads
  FOR DELETE
  USING (public.is_approved_user());

COMMIT;

