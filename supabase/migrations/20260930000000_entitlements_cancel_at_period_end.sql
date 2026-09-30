alter table public.entitlements
  add column cancel_at_period_end boolean not null default false;
