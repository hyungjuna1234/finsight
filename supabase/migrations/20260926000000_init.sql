create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('privacy', 'overseas_transfer', 'terms', 'age14')),
  version text not null,
  agreed_at timestamptz not null default now()
);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive',
  period_end timestamptz,
  synced_at timestamptz,
  free_insight_used_at timestamptz
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  storage_path text not null,
  filename text not null,
  sha256 text not null,
  byte_size bigint not null,
  status text not null check (status in ('uploaded', 'awaiting_confirm', 'done', 'failed')),
  error_code text,
  mapping jsonb,
  header_signature text,
  period_from date,
  period_to date,
  counts jsonb,
  original_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index uploads_user_sha256_active_key
  on public.uploads (user_id, sha256) where status <> 'failed';

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  upload_id uuid not null references public.uploads(id) on delete cascade,
  occurred_on date not null,
  merchant_raw text not null,
  merchant_key text not null,
  amount_krw bigint not null check (amount_krw >= 0),
  kind text not null check (kind in ('spend', 'refund')),
  status text not null check (status in ('posted', 'pending', 'cancelled')),
  installment_months integer,
  foreign_amount numeric,
  foreign_currency text,
  approval_no text,
  category text not null check (category in ('식비', '카페·간식', '마트·편의점', '교통', '자동차', '쇼핑', '주거·통신', '의료·건강', '교육', '문화·여가', '여행·숙박', '구독·디지털', '보험·금융', '경조사·선물', '기타')),
  category_source text not null check (category_source in ('user', 'history', 'rule', 'ai', 'pending')),
  identity_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, identity_key)
);
create index transactions_user_occurred_on_idx on public.transactions (user_id, occurred_on);

create table public.header_mappings (
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  mapping jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, signature)
);

create table public.category_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  category text not null check (category in ('식비', '카페·간식', '마트·편의점', '교통', '자동차', '쇼핑', '주거·통신', '의료·건강', '교육', '문화·여가', '여행·숙박', '구독·디지털', '보험·금융', '경조사·선물', '기타')),
  primary key (user_id, merchant_key)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('mapping', 'classify', 'insight', 'chat')),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_feature_created_at_idx on public.ai_usage (user_id, feature, created_at);

alter table public.consents enable row level security;
alter table public.entitlements enable row level security;
alter table public.cards enable row level security;
alter table public.uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.header_mappings enable row level security;
alter table public.category_overrides enable row level security;
alter table public.insights enable row level security;
alter table public.ai_usage enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

grant select, insert on public.consents to authenticated;
grant select on public.entitlements to authenticated;
grant select, insert, update, delete on public.cards, public.uploads, public.transactions,
  public.header_mappings, public.category_overrides, public.insights to authenticated;
grant select, insert on public.ai_usage to authenticated;
grant all on all tables in schema public to service_role;

create policy consents_select on public.consents for select to authenticated using ((select auth.uid()) = user_id);
create policy consents_insert on public.consents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy entitlements_select on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);

create policy cards_select on public.cards for select to authenticated using ((select auth.uid()) = user_id);
create policy cards_insert on public.cards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy cards_update on public.cards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cards_delete on public.cards for delete to authenticated using ((select auth.uid()) = user_id);

create policy uploads_select on public.uploads for select to authenticated using ((select auth.uid()) = user_id);
create policy uploads_insert on public.uploads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy uploads_update on public.uploads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy uploads_delete on public.uploads for delete to authenticated using ((select auth.uid()) = user_id);

create policy transactions_select on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy header_mappings_select on public.header_mappings for select to authenticated using ((select auth.uid()) = user_id);
create policy header_mappings_insert on public.header_mappings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy header_mappings_update on public.header_mappings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy header_mappings_delete on public.header_mappings for delete to authenticated using ((select auth.uid()) = user_id);

create policy category_overrides_select on public.category_overrides for select to authenticated using ((select auth.uid()) = user_id);
create policy category_overrides_insert on public.category_overrides for insert to authenticated with check ((select auth.uid()) = user_id);
create policy category_overrides_update on public.category_overrides for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy category_overrides_delete on public.category_overrides for delete to authenticated using ((select auth.uid()) = user_id);

create policy insights_select on public.insights for select to authenticated using ((select auth.uid()) = user_id);
create policy insights_insert on public.insights for insert to authenticated with check ((select auth.uid()) = user_id);
create policy insights_update on public.insights for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy insights_delete on public.insights for delete to authenticated using ((select auth.uid()) = user_id);

create policy ai_usage_select on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_usage_insert on public.ai_usage for insert to authenticated with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('statements', 'statements', false, 10485760)
on conflict (id) do nothing;
