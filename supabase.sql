-- Le Panier : une ligne par utilisateur, visible uniquement par lui-même.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "lecture de ses données" on public.app_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ajout de ses données" on public.app_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modification de ses données" on public.app_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "suppression de ses données" on public.app_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Mise à jour en direct entre appareils
alter publication supabase_realtime add table public.app_state;
