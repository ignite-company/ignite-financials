-- Ignite Financials read-only bank transaction storage.
-- Applied to the linked Supabase project on 2026-10-19.
-- Plaid access tokens are encrypted in Vercel server functions before storage.
-- Browser clients have no direct table privileges for this data.
create table if not exists public.finance_bank_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null check(scope in ('business','personal')),
 plaid_item_id text not null unique,
 access_token_ciphertext text not null,
 institution_id text,
 institution_name text not null default 'Connected bank',
 sync_cursor text,
 status text not null default 'active' check(status in ('active','error')),
 last_synced_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists finance_bank_items_owner_idx on public.finance_bank_items(user_id,scope);
create table if not exists public.finance_bank_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 bank_item_id uuid not null references public.finance_bank_items(id) on delete cascade,
 plaid_account_id text not null unique,
 scope text not null check(scope in ('business','personal')),
 name text not null,
 official_name text,
 mask text,
 type text,
 subtype text,
 created_at timestamptz not null default now()
);
create index if not exists finance_bank_accounts_owner_idx on public.finance_bank_accounts(user_id,scope);
create table if not exists public.finance_bank_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 bank_item_id uuid not null references public.finance_bank_items(id) on delete cascade,
 plaid_transaction_id text not null unique,
 plaid_account_id text not null,
 scope text not null check(scope in ('business','personal')),
 date date not null,
 description text not null,
 merchant_name text,
 amount numeric(14,2) not null,
 category_primary text,
 category_detailed text,
 category_override text,
 tags text[] not null default '{}',
 bucket_id uuid references public.finance_buckets(id) on delete set null,
 pending boolean not null default false,
 is_removed boolean not null default false,
 updated_at timestamptz not null default now()
);
create index if not exists finance_bank_transactions_owner_date_idx on public.finance_bank_transactions(user_id,scope,date desc);
create index if not exists finance_bank_transactions_item_idx on public.finance_bank_transactions(bank_item_id);
alter table public.finance_bank_items enable row level security;
alter table public.finance_bank_accounts enable row level security;
alter table public.finance_bank_transactions enable row level security;
revoke all on public.finance_bank_items,public.finance_bank_accounts,public.finance_bank_transactions from anon,authenticated;
