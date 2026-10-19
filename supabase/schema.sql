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
grant select,insert,update,delete on public.finance_accounts,public.finance_transactions to authenticated;
grant select on public.finance_buckets to authenticated;
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
 if new.type<>'income' or new.category='Transfer' then return new; end if;
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
create trigger finance_income_allocate after insert or update of amount,type,scope,category
on public.finance_transactions for each row execute function public.finance_allocate_income();

-- Server-side idempotent initialization. Never seed buckets directly in React.
create or replace function public.finance_ensure_default_buckets()
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text),71942);
 insert into public.finance_buckets(user_id,scope,name,percentage,color,sort_order)
 select v_user,d.scope,d.name,d.percentage,d.color,d.sort_order from
 (values
 ('business','Taxes',25::numeric,'#171717',0),
 ('business','Operations',25::numeric,'#e53935',1),
 ('business','Owner pay',35::numeric,'#8b8f9a',2),
 ('business','Cash reserves',15::numeric,'#d9a441',3),
 ('personal','Essentials',50::numeric,'#171717',0),
 ('personal','Lifestyle',25::numeric,'#e53935',1),
 ('personal','Savings',15::numeric,'#8b8f9a',2),
 ('personal','Buffer',10::numeric,'#d9a441',3)
 ) as d(scope,name,percentage,color,sort_order)
 on conflict(user_id,scope,name) do nothing;
end $$;
revoke all on function public.finance_ensure_default_buckets() from public,anon,authenticated;
grant execute on function public.finance_ensure_default_buckets() to authenticated;

-- Update all percentages atomically and validate complete 100% distribution.
create or replace function public.finance_save_bucket_rules(p_scope text,p_rules jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=(select auth.uid());
 v_count integer;v_unique integer;v_invalid integer;
 v_expected integer;v_matching integer;v_total numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_scope not in ('business','personal') then raise exception 'Invalid workspace'; end if;
 if p_rules is null or jsonb_typeof(p_rules)<>'array' then raise exception 'Invalid allocation payload'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text),71942);
 select count(*),count(distinct r.id),count(*) filter(where r.id is null or r.percentage is null or r.percentage<0 or r.percentage>100),coalesce(sum(r.percentage),0)
 into v_count,v_unique,v_invalid,v_total
 from jsonb_to_recordset(p_rules) as r(id uuid,percentage numeric);
 if v_count=0 or v_unique<>v_count or v_invalid>0 or v_total<>100
 then raise exception 'Every bucket must have a valid unique ID and percentages must total exactly 100';end if;
 select count(*) into v_expected from public.finance_buckets where user_id=v_user and scope=p_scope;
 select count(*) into v_matching from public.finance_buckets b
 join jsonb_to_recordset(p_rules) as r(id uuid,percentage numeric) on r.id=b.id
 where b.user_id=v_user and b.scope=p_scope;
 if v_matching<>v_count or v_expected<>v_count
 then raise exception 'Allocation rules do not match all your current buckets. Reload and try again';end if;
 update public.finance_buckets b set percentage=r.percentage
 from jsonb_to_recordset(p_rules) as r(id uuid,percentage numeric)
 where b.id=r.id and b.user_id=v_user and b.scope=p_scope;
end $$;
revoke all on function public.finance_save_bucket_rules(text,jsonb) from public,anon,authenticated;
grant execute on function public.finance_save_bucket_rules(text,jsonb) to authenticated;
