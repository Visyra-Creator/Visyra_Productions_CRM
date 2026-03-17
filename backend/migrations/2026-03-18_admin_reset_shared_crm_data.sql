-- =============================================================================
-- Admin RPC: Reset shared CRM data for all approved users
-- Date: 2026-03-18
--
-- Purpose:
--   - Adds a single RPC that deletes all shared CRM business data.
--   - Designed for "factory reset" from Settings.
--   - Applies globally, so changes reflect for admin + all users.
--
-- Scope reset:
--   clients, leads, shoots, payments, payment_records,
--   expenses, packages, portfolio, locations, location_images, app_options
--
-- Notes:
--   - Does NOT delete auth users / public.users accounts.
--   - Only approved admin can execute.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_reset_shared_crm_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.approved = true
  ) THEN
    RAISE EXCEPTION 'Only approved admins can reset CRM data';
  END IF;

  TRUNCATE TABLE
    public.payment_records,
    public.expenses,
    public.payments,
    public.shoots,
    public.leads,
    public.clients,
    public.location_images,
    public.locations,
    public.portfolio,
    public.packages,
    public.app_options
  RESTART IDENTITY CASCADE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_shared_crm_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_shared_crm_data() TO authenticated;

