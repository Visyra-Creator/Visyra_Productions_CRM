-- =============================================================================
-- Shared team access for all CRM business tables (admin + approved employees)
-- Date: 2026-03-18
--
-- Goal:
--   - Allow different signed-in team accounts to read/write the same CRM data
--   - Keep authentication and approval required
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

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','leads','shoots','payments','payment_records','expenses',
    'packages','portfolio','locations','location_images','app_options'
  ]
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_approved_user())',
      t || '_team_select',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_approved_user())',
      t || '_team_insert',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_approved_user()) WITH CHECK (public.is_approved_user())',
      t || '_team_update',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_approved_user())',
      t || '_team_delete',
      t
    );
  END LOOP;
END $$;

COMMIT;

