-- =============================================================================
-- Owner-scoped RLS for CRM business tables
-- Date: 2026-03-18
--
-- Goal:
--   - Enforce per-user data isolation with user_id = auth.uid()
--   - Keep same-user multi-device consistency
-- =============================================================================

BEGIN;

-- 1) Add user_id to business tables
ALTER TABLE IF EXISTS public.clients         ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.leads           ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.shoots          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.payments        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.payment_records ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.expenses        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.packages        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.portfolio       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.locations       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.location_images ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS public.app_options     ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Helpful defaults for all future inserts
ALTER TABLE IF EXISTS public.clients         ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.leads           ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.shoots          ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.payments        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.payment_records ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.expenses        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.packages        ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.portfolio       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.locations       ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.location_images ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE IF EXISTS public.app_options     ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3) Backfill from parent relationships where possible
UPDATE public.shoots s
SET user_id = c.user_id
FROM public.clients c
WHERE s.user_id IS NULL
  AND s.client_id = c.id
  AND c.user_id IS NOT NULL;

UPDATE public.payments p
SET user_id = c.user_id
FROM public.clients c
WHERE p.user_id IS NULL
  AND p.client_id = c.id
  AND c.user_id IS NOT NULL;

UPDATE public.payments p
SET user_id = s.user_id
FROM public.shoots s
WHERE p.user_id IS NULL
  AND p.shoot_id = s.id
  AND s.user_id IS NOT NULL;

UPDATE public.payment_records pr
SET user_id = p.user_id
FROM public.payments p
WHERE pr.user_id IS NULL
  AND pr.invoice_id = p.id
  AND p.user_id IS NOT NULL;

UPDATE public.expenses e
SET user_id = s.user_id
FROM public.shoots s
WHERE e.user_id IS NULL
  AND e.shoot_id = s.id
  AND s.user_id IS NOT NULL;

UPDATE public.location_images li
SET user_id = l.user_id
FROM public.locations l
WHERE li.user_id IS NULL
  AND li.location_id = l.id
  AND l.user_id IS NOT NULL;

-- 4) Indexes for owner-scoped queries
CREATE INDEX IF NOT EXISTS idx_clients_user_id         ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id           ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_shoots_user_id          ON public.shoots(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id        ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON public.payment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id        ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_user_id        ON public.packages(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id       ON public.portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_id       ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_location_images_user_id ON public.location_images(user_id);
CREATE INDEX IF NOT EXISTS idx_app_options_user_id     ON public.app_options(user_id);

-- 5) Enable RLS
ALTER TABLE IF EXISTS public.clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shoots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.packages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.portfolio       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_options     ENABLE ROW LEVEL SECURITY;

-- 6) Drop previous policies for target tables
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
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- 7) Owner policies
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','leads','shoots','payments','payment_records','expenses',
    'packages','portfolio','locations','location_images','app_options'
  ]
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.uid() = user_id)', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (auth.uid() = user_id)', t || '_delete_own', t);
  END LOOP;
END $$;

COMMIT;

