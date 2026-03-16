-- Strict normalized schema alignment for VisyraProductionsCRM
-- Run in Supabase SQL editor.

begin;

create extension if not exists pgcrypto;

-- Align core business tables with fields used by frontend forms/workflows.

-- clients
alter table public.clients add column if not exists client_id text;
alter table public.clients add column if not exists name text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists company_name text;
alter table public.clients add column if not exists event_type text;
alter table public.clients add column if not exists event_date date;
alter table public.clients add column if not exists event_dates jsonb;
alter table public.clients add column if not exists date_selection_mode text;
alter table public.clients add column if not exists event_location text;
alter table public.clients add column if not exists package_name text;
alter table public.clients add column if not exists total_price numeric;
alter table public.clients add column if not exists lead_source text;
alter table public.clients add column if not exists status text;
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists next_follow_up date;
alter table public.clients add column if not exists created_at timestamptz default now();

-- leads
alter table public.leads add column if not exists lead_id text;
alter table public.leads add column if not exists name text;
alter table public.leads add column if not exists company_name text;
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists event_type text;
alter table public.leads add column if not exists event_location text;
alter table public.leads add column if not exists package_name text;
alter table public.leads add column if not exists total_price numeric;
alter table public.leads add column if not exists status text;
alter table public.leads add column if not exists budget numeric;
alter table public.leads add column if not exists stage text;
alter table public.leads add column if not exists notes text;
alter table public.leads add column if not exists event_date date;
alter table public.leads add column if not exists next_follow_up date;
alter table public.leads add column if not exists created_at timestamptz default now();

-- shoots
alter table public.shoots add column if not exists client_id uuid;
alter table public.shoots add column if not exists event_type text;
alter table public.shoots add column if not exists shoot_date date;
alter table public.shoots add column if not exists start_time text;
alter table public.shoots add column if not exists end_time text;
alter table public.shoots add column if not exists location text;
alter table public.shoots add column if not exists notes text;
alter table public.shoots add column if not exists status text;
alter table public.shoots add column if not exists created_at timestamptz default now();

-- payments (invoice-style rows)
alter table public.payments add column if not exists payment_id text;
alter table public.payments add column if not exists client_id uuid;
alter table public.payments add column if not exists shoot_id uuid;
alter table public.payments add column if not exists total_amount numeric;
alter table public.payments add column if not exists due_date date;
alter table public.payments add column if not exists payment_date date;
alter table public.payments add column if not exists status text;
alter table public.payments add column if not exists balance numeric;
alter table public.payments add column if not exists created_at timestamptz default now();

-- expenses
alter table public.expenses add column if not exists expense_id text;
alter table public.expenses add column if not exists title text;
alter table public.expenses add column if not exists amount numeric;
alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists paid_to text;
alter table public.expenses add column if not exists payment_method text;
alter table public.expenses add column if not exists status text;
alter table public.expenses add column if not exists date date;
alter table public.expenses add column if not exists notes text;
alter table public.expenses add column if not exists shoot_id uuid;
alter table public.expenses add column if not exists created_at timestamptz default now();

-- packages
alter table public.packages add column if not exists name text;
alter table public.packages add column if not exists event_type text;
alter table public.packages add column if not exists price numeric;
alter table public.packages add column if not exists duration_hours integer;
alter table public.packages add column if not exists covers text;
alter table public.packages add column if not exists team_type text;
alter table public.packages add column if not exists team_size integer;
alter table public.packages add column if not exists deliverables text;
alter table public.packages add column if not exists description text;
alter table public.packages add column if not exists created_at timestamptz default now();

-- locations
alter table public.locations add column if not exists name text;
alter table public.locations add column if not exists type text;
alter table public.locations add column if not exists city text;
alter table public.locations add column if not exists is_paid integer;
alter table public.locations add column if not exists price numeric;
alter table public.locations add column if not exists address text;
alter table public.locations add column if not exists venue_name text;
alter table public.locations add column if not exists landmark text;
alter table public.locations add column if not exists google_maps_url text;
alter table public.locations add column if not exists notes text;
alter table public.locations add column if not exists created_at timestamptz default now();

-- portfolio
alter table public.portfolio add column if not exists title text;
alter table public.portfolio add column if not exists media_type text;
alter table public.portfolio add column if not exists file_path text;
alter table public.portfolio add column if not exists thumbnail_path text;
alter table public.portfolio add column if not exists category text;
alter table public.portfolio add column if not exists featured integer default 0;
alter table public.portfolio add column if not exists created_at timestamptz default now();

-- Ensure app_options has the columns used by customization + seed flows.
create table if not exists public.app_options (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  type text,
  label text,
  value text,
  color text,
  created_at timestamptz default now()
);

alter table public.app_options add column if not exists key text;
alter table public.app_options add column if not exists type text;
alter table public.app_options add column if not exists label text;
alter table public.app_options add column if not exists value text;
alter table public.app_options add column if not exists color text;
alter table public.app_options add column if not exists created_at timestamptz default now();

-- Dedicated payment records table (instead of overloading payments).
create table if not exists public.payment_records (
  id bigint generated by default as identity primary key,
  invoice_id uuid references public.payments(id) on delete cascade,
  amount numeric,
  payment_date date,
  payment_method text,
  notes text,
  created_at timestamptz default now()
);

alter table public.payment_records add column if not exists invoice_id uuid;
alter table public.payment_records add column if not exists amount numeric;
alter table public.payment_records add column if not exists payment_date date;
alter table public.payment_records add column if not exists payment_method text;
alter table public.payment_records add column if not exists notes text;
alter table public.payment_records add column if not exists created_at timestamptz default now();

create index if not exists idx_payment_records_invoice_id on public.payment_records(invoice_id);
create index if not exists idx_payment_records_payment_date on public.payment_records(payment_date);

-- Dedicated location image mapping table.
create table if not exists public.location_images (
  id bigint generated by default as identity primary key,
  location_id uuid references public.locations(id) on delete cascade,
  image_path text,
  created_at timestamptz default now()
);

alter table public.location_images add column if not exists location_id uuid;
alter table public.location_images add column if not exists image_path text;
alter table public.location_images add column if not exists created_at timestamptz default now();

create index if not exists idx_location_images_location_id on public.location_images(location_id);

-- Backfill payment_records from payments rows that look like payment entries.
-- This is schema-aware to avoid failures when payments.invoice_id is absent.
do $$
declare
  has_invoice_id boolean;
  has_amount boolean;
  has_payment_date boolean;
  has_payment_method boolean;
  has_notes boolean;
  has_created_at boolean;
  invoice_expr text;
  sql text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'invoice_id'
  ) into has_invoice_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'amount'
  ) into has_amount;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_date'
  ) into has_payment_date;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_method'
  ) into has_payment_method;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'notes'
  ) into has_notes;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'created_at'
  ) into has_created_at;

  -- If amount doesn't exist, there is nothing meaningful to backfill.
  if not has_amount then
    raise notice 'Skipping payment_records backfill: payments.amount column not found.';
    return;
  end if;

  -- Prefer payments.invoice_id when present; otherwise use payments.id as the invoice reference.
  if has_invoice_id then
    invoice_expr := 'p.invoice_id';
  else
    invoice_expr := 'p.id';
  end if;

  sql := format(
    'insert into public.payment_records (invoice_id, amount, payment_date, payment_method, notes, created_at)
     select
       %1$s,
       p.amount,
       %2$s,
       %3$s,
       %4$s,
       %5$s
     from public.payments p
     where %1$s is not null
       and p.amount is not null
       and not exists (
         select 1
         from public.payment_records pr
         where pr.invoice_id = %1$s
           and coalesce(pr.amount, 0) = coalesce(p.amount, 0)
           and coalesce(pr.payment_date::text, '''') = coalesce(%2$s::text, '''')
           and coalesce(pr.payment_method, '''') = coalesce(%3$s, '''')
           and coalesce(pr.notes, '''') = coalesce(%4$s, '''')
       );',
    invoice_expr,
    case when has_payment_date then 'p.payment_date' else 'null::date' end,
    case when has_payment_method then 'p.payment_method' else 'null::text' end,
    case when has_notes then 'p.notes' else 'null::text' end,
    case when has_created_at then 'coalesce(p.created_at, now())' else 'now()' end
  );

  execute sql;
end $$;

commit;

