-- Ignite Financials database schema.
-- Already applied to the Ignite Supabase instance on 2026-10-19.
-- New installations: apply in Supabase SQL Editor. Do not run repeatedly after schema changes.

create table if not exists public.finance_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 scope text not null default 'business' check (scope in ('business','personal')),
 opening_balance numeric(14,2) not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.finance_buckets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null default 'business' check (scope in ('business','personal')),
 name text not null,
 percentage numeric(5,2) not null default 0 check (percentage>=0 and percentage<=100),
 color text not null default '#ef4444',
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 unique(user_id, scope, name)
);
create table if not exists public.finance_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid references public.finance_accounts(id) on delete set null,
 bucket_id uuid references public.finance_buckets(id) on delete set null,
 scope text not null default 'business' check (scope in ('business','personal')),
 type text not null check (type in ('income','expense')),
 date date not null default current_date,
 description text not null,
 amount numeric(14,2) not null check (amount>0),
 category text not null default 'Other',
 payer text,
 project text,
 notes text,
 source text not null default 'manual' check (source in ('manual','csv')),
 fingerprint text,
 created_at timestamptz not null default now(),
 unique(user_id,fingerprint)
);
create table if not exists public.finance_allocations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 transaction_id uuid not null references public.finance_transactions(id) on delete cascade,
 bucket_id uuid not null references public.finance_buckets(id) on delete cascade,
 amount numeric(14,2) not null,
 created_at timestamptz not null default now(),
 unique(transaction_id,bucket_id)
);
create index if not exists finance_transactions_owner_date on public.finance_transactions(user_id,date desc);
create index if not exists finance_transactions_owner_type on public.finance_transactions(user_id,type);
create index if not exists finance_allocations_owner on public.finance_allocations(user_id,bucket_id);
alter table public.finance_accounts enable row level security;
alter table public.finance_buckets enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_allocations enable row level security;

create policy "finance_accounts_own" on public.finance_accounts
 for all to authenticated using((select auth.uid())=user_id)
 with check((select auth.uid())=user_id);
create policy "finance_buckets_own" on public.finance_buckets
 for all to authenticated using((select auth.uid())=user_id)
 with check((select auth.uid())=user_id);
create policy "finance_transactions_own" on public.finance_transactions
 for all to authenticated using((select auth.uid())=user_id)
 with check((select auth.uid())=user_id);
create policy "finance_allocations_read" on public.finance_allocations
 for select to authenticated using((select auth.uid())=user_id);

revoke all on public.finance_accounts,public.finance_buckets,public.finance_transactions,public.finance_allocations from anon,authenticated;
grant select,insert,update,delete on public.finance_accounts,public.finance_buckets,public.finance_transactions to authenticated;
grant select on public.finance_allocations to authenticated;

create or replace function public.finance_validate_transaction_refs()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.account_id is not null and not exists
   (select 1 from public.finance_accounts where id=new.account_id and user_id=new.user_id and scope=new.scope)
 then raise exception 'Account must belong to same owner and workspace'; end if;
 if new.bucket_id is not null and not exists
   (select 1 from public.finance_buckets where id=new.bucket_id and user_id=new.user_id and scope=new.scope)
 then raise exception 'Bucket must belong to same owner and workspace'; end if;
 if new.type='income' and new.bucket_id is not null then
  raise exception 'Income allocation is automatic'; end if;
 return new;
end $$;
revoke execute on function public.finance_validate_transaction_refs() from public,anon,authenticated;
create trigger finance_validate_refs before insert or update on public.finance_transactions
for each row execute function public.finance_validate_transaction_refs();

create or replace function public.finance_allocate_income()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 b record;
 eligible_count integer;
 processed integer:=0;
 remainder numeric(14,2);
 allocated numeric(14,2);
begin
 delete from public.finance_allocations where transaction_id=new.id;
 if new.type<>'income' then return new; end if;
 select count(*) into eligible_count from public.finance_buckets
   where user_id=new.user_id and scope=new.scope and percentage>0;
 if eligible_count=0 then return new; end if;
 remainder:=new.amount;
 for b in select id,percentage from public.finance_buckets
   where user_id=new.user_id and scope=new.scope and percentage>0
   order by sort_order,created_at,id
 loop
  processed:=processed+1;
  if processed=eligible_count then
   allocated:=remainder;
  else
   allocated:=least(round(new.amount*b.percentage/100,2),remainder);
  end if;
  if allocated>0 then
   insert into public.finance_allocations(user_id,transaction_id,bucket_id,amount)
   values(new.user_id,new.id,b.id,allocated);
  end if;
  remainder:=remainder-allocated;
 end loop;
 return new;
end $$;
revoke execute on function public.finance_allocate_income() from public,anon,authenticated;
create trigger finance_income_allocate after insert or update of amount,type,scope
on public.finance_transactions for each row execute function public.finance_allocate_income();
