create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  items jsonb not null,
  total integer not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'making', 'ready', 'served')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
grant select, insert, update on public.orders to anon, authenticated;

drop policy if exists "Anyone can view pretend orders" on public.orders;
create policy "Anyone can view pretend orders"
  on public.orders for select
  using (true);

drop policy if exists "Anyone can place pretend orders" on public.orders;
create policy "Anyone can place pretend orders"
  on public.orders for insert
  with check (true);

drop policy if exists "Anyone can update pretend orders" on public.orders;
create policy "Anyone can update pretend orders"
  on public.orders for update
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;