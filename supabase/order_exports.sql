create table if not exists public.yb_order_exports (
 token text primary key check (length(token)=64),
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.yb_order_exports enable row level security;
revoke all on public.yb_order_exports from anon, authenticated;
