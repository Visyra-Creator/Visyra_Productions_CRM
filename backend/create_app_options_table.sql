create table app_options (
id uuid primary key default gen_random_uuid(),
key text unique not null,
value text,
created_at timestamp with time zone default now()
);

