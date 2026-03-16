-- =============================================================================
-- RLS: payments and expenses tables
-- Only admins can read/write these tables.
-- Employees have zero access at the database level regardless of client-side guards.
-- =============================================================================

-- ── payments ─────────────────────────────────────────────────────────────────

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies first so this script is idempotent
DROP POLICY IF EXISTS "admins_all_payments"      ON public.payments;
DROP POLICY IF EXISTS "employees_read_payments"  ON public.payments;

-- Admins have full access
CREATE POLICY "admins_all_payments"
  ON public.payments
  FOR ALL
  USING      ( public.get_my_role() = 'admin' )
  WITH CHECK ( public.get_my_role() = 'admin' );

-- ── expenses ─────────────────────────────────────────────────────────────────

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_expenses"      ON public.expenses;
DROP POLICY IF EXISTS "employees_read_expenses"  ON public.expenses;

-- Admins have full access
CREATE POLICY "admins_all_expenses"
  ON public.expenses
  FOR ALL
  USING      ( public.get_my_role() = 'admin' )
  WITH CHECK ( public.get_my_role() = 'admin' );

-- ── payment_records ──────────────────────────────────────────────────────────

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_payment_records" ON public.payment_records;

CREATE POLICY "admins_all_payment_records"
  ON public.payment_records
  FOR ALL
  USING      ( public.get_my_role() = 'admin' )
  WITH CHECK ( public.get_my_role() = 'admin' );

-- =============================================================================
-- NOTE: get_my_role() was created in 2026-03-17_users_auth_audit_fix.sql
-- Run that migration before this one.
-- =============================================================================

