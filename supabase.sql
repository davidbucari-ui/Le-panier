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

-- ============================================================
-- Listes de courses partagées (famille) : une liste, ses membres, ses articles.
-- On rejoint une liste par son code d'invitation (fonction join_shared_list).
-- ============================================================
create table if not exists public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  created_at timestamptz not null default now()
);
create table if not exists public.shared_list_members (
  list_id uuid not null references public.shared_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists shared_list_members_user_idx on public.shared_list_members(user_id);
create table if not exists public.shared_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_lists(id) on delete cascade,
  n text not null check (char_length(n) between 1 and 120),
  q numeric not null default 0 check (q >= 0 and q < 10000000),
  u text not null default '' check (u in ('', 'g', 'ml')),
  r text not null default '' check (char_length(r) <= 40),
  done boolean not null default false,
  by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_items_list_idx on public.shared_items(list_id);
create index if not exists shared_items_by_idx on public.shared_items(by);
create index if not exists shared_lists_owner_idx on public.shared_lists(owner);

-- membre d'une liste ? (security definer : évite la récursion des politiques)
create or replace function public.is_list_member(l uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_list_members m where m.list_id = l and m.user_id = (select auth.uid()))
$$;
revoke execute on function public.is_list_member(uuid) from public, anon;
grant execute on function public.is_list_member(uuid) to authenticated;

alter table public.shared_lists enable row level security;
alter table public.shared_list_members enable row level security;
alter table public.shared_items enable row level security;

create policy "membres : lecture de la liste" on public.shared_lists
  for select to authenticated using (public.is_list_member(id));
create policy "propriétaire : renommer" on public.shared_lists
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "propriétaire : supprimer" on public.shared_lists
  for delete to authenticated using (owner = (select auth.uid()));

create policy "membres : voir les membres" on public.shared_list_members
  for select to authenticated using (public.is_list_member(list_id));
create policy "membre : changer son nom" on public.shared_list_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "membre : quitter, ou propriétaire : retirer" on public.shared_list_members
  for delete to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.shared_lists l where l.id = list_id and l.owner = (select auth.uid())));

create policy "membres : lire les articles" on public.shared_items
  for select to authenticated using (public.is_list_member(list_id));
create policy "membres : ajouter" on public.shared_items
  for insert to authenticated with check (public.is_list_member(list_id) and by = (select auth.uid()));
create policy "membres : modifier" on public.shared_items
  for update to authenticated using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));
create policy "membres : retirer" on public.shared_items
  for delete to authenticated using (public.is_list_member(list_id));

-- créer une liste (et en devenir membre)
create or replace function public.create_shared_list(p_name text, p_me text) returns public.shared_lists
language plpgsql security definer set search_path = '' as $$
declare l public.shared_lists;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if (select count(*) from public.shared_lists where owner = auth.uid()) >= 20 then raise exception 'trop de listes'; end if;
  insert into public.shared_lists(name, owner) values (left(trim(p_name), 60), auth.uid()) returning * into l;
  insert into public.shared_list_members(list_id, user_id, name) values (l.id, auth.uid(), left(trim(coalesce(p_me, '')), 40));
  return l;
end $$;
-- rejoindre une liste avec son code d'invitation
create or replace function public.join_shared_list(p_code text, p_me text) returns public.shared_lists
language plpgsql security definer set search_path = '' as $$
declare l public.shared_lists;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into l from public.shared_lists where code = lower(trim(p_code));
  if not found then raise exception 'code inconnu'; end if;
  insert into public.shared_list_members(list_id, user_id, name) values (l.id, auth.uid(), left(trim(coalesce(p_me, '')), 40))
    on conflict (list_id, user_id) do nothing;
  return l;
end $$;
revoke execute on function public.create_shared_list(text, text) from public, anon;
revoke execute on function public.join_shared_list(text, text) from public, anon;
grant execute on function public.create_shared_list(text, text) to authenticated;
grant execute on function public.join_shared_list(text, text) to authenticated;

alter publication supabase_realtime add table public.shared_lists, public.shared_list_members, public.shared_items;

-- ============================================================
-- Photos de recettes : espace de stockage privé « recettes », un dossier par utilisateur (<uid>/<recette>-<date>.jpg).
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recettes', 'recettes', false, 2097152, array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;
create policy "photos de recettes : lire les siennes" on storage.objects
  for select to authenticated using (bucket_id = 'recettes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos de recettes : ajouter dans son dossier" on storage.objects
  for insert to authenticated with check (bucket_id = 'recettes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos de recettes : remplacer les siennes" on storage.objects
  for update to authenticated using (bucket_id = 'recettes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recettes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos de recettes : supprimer les siennes" on storage.objects
  for delete to authenticated using (bucket_id = 'recettes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================
-- Recettes communes (migration « recettes_communes ») : tout membre connecté lit toutes les recettes ;
-- chacun n'ajoute, ne modifie et ne supprime que les siennes. Les photos deviennent lisibles par tous
-- les membres connectés (l'espace reste privé : liens signés seulement).
-- ============================================================
create table if not exists public.shared_recipes (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_recipes_owner on public.shared_recipes(owner);
alter table public.shared_recipes enable row level security;
create policy "recettes : tous les membres lisent" on public.shared_recipes
  for select to authenticated using (true);
create policy "recettes : ajouter les siennes" on public.shared_recipes
  for insert to authenticated with check (owner = (select auth.uid()));
create policy "recettes : modifier les siennes" on public.shared_recipes
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "recettes : supprimer les siennes" on public.shared_recipes
  for delete to authenticated using (owner = (select auth.uid()));
alter publication supabase_realtime add table public.shared_recipes;

drop policy if exists "photos de recettes : lire les siennes" on storage.objects;
create policy "photos de recettes : lire (tous les membres)" on storage.objects
  for select to authenticated using (bucket_id = 'recettes');

-- ============================================================
-- Commentaires sur les recettes communes (migration « commentaires_recettes ») : tous les membres lisent
-- et commentent ; chacun ne supprime que les siens ; supprimés avec la recette.
-- ============================================================
create table if not exists public.recipe_comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.shared_recipes(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author text not null default '' check (char_length(author) <= 40),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists recipe_comments_recipe on public.recipe_comments(recipe_id);
create index if not exists recipe_comments_owner on public.recipe_comments(owner);
alter table public.recipe_comments enable row level security;
create policy "commentaires : tous les membres lisent" on public.recipe_comments
  for select to authenticated using (true);
create policy "commentaires : ajouter les siens" on public.recipe_comments
  for insert to authenticated with check (owner = (select auth.uid()));
create policy "commentaires : supprimer les siens" on public.recipe_comments
  for delete to authenticated using (owner = (select auth.uid()));
alter publication supabase_realtime add table public.recipe_comments;
