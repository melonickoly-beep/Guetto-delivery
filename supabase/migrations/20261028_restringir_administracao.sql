-- NÃO EXECUTAR EM PRODUÇÃO SEM APROVAÇÃO.
-- Antes de aplicar, na mesma sessão: SET app.admin_user_id = 'UUID aprovado';
begin;
create table if not exists public.administrador_autorizado (
  unico boolean primary key default true check (unico),
  usuario_id uuid not null unique references auth.users(id)
);
alter table public.administrador_autorizado enable row level security;
revoke all on public.administrador_autorizado from public, anon, authenticated;
do $$
declare v_id uuid := nullif(current_setting('app.admin_user_id', true), '')::uuid;
begin
  if v_id is null then raise exception 'Defina app.admin_user_id com o UUID aprovado antes de aplicar'; end if;
  insert into public.administrador_autorizado values (true, v_id)
    on conflict (unico) do update set usuario_id = excluded.usuario_id;
end $$;
create or replace function public.eh_administrador_autorizado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.administrador_autorizado where usuario_id = (select auth.uid()));
$$;
revoke all on function public.eh_administrador_autorizado() from public;
grant execute on function public.eh_administrador_autorizado() to anon, authenticated, service_role;
-- Remove políticas permissivas anteriores: políticas permissivas se somam com OR.
do $$
declare r record; t text;
begin
  for r in select tablename, policyname from pg_policies where schemaname='public'
    and tablename in ('categorias','produtos','configuracoes','pedidos') loop
    execute format('drop policy %I on public.%I',r.policyname,r.tablename);
  end loop;
  foreach t in array array['categorias','produtos','configuracoes','pedidos'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create policy administrador on public.%I for all to authenticated using ((select public.eh_administrador_autorizado())) with check ((select public.eh_administrador_autorizado()))',t);
  end loop;
end $$;
grant select on public.categorias, public.produtos, public.configuracoes to anon;
create policy catalogo on public.categorias for select to anon, authenticated using (true);
create policy catalogo on public.produtos for select to anon, authenticated using (true);
create policy configuracao_publica on public.configuracoes for select to anon, authenticated
  using (chave in ('tempo_entrega','horario_abertura','horario_fechamento','somente_retirada','detalhes_essencias'));
-- Restritivas também bloqueiam eventuais políticas permissivas antigas de Storage.
create policy proteger_imagens_insert on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'produtos' or (select public.eh_administrador_autorizado()));
create policy proteger_imagens_update on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'produtos' or (select public.eh_administrador_autorizado()))
  with check (bucket_id <> 'produtos' or (select public.eh_administrador_autorizado()));
create policy proteger_imagens_delete on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'produtos' or (select public.eh_administrador_autorizado()));
create policy proteger_resumos on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'resumos-sorteio' or (select public.eh_administrador_autorizado()))
  with check (bucket_id <> 'resumos-sorteio' or (select public.eh_administrador_autorizado()));
-- Funções privilegiadas não são uma porta alternativa ao RLS.
do $$ declare r record;
begin
  for r in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname <> 'eh_administrador_autorizado' loop
    execute format('revoke all on function %s from public, anon, authenticated',r.assinatura);
    execute format('grant execute on function %s to service_role',r.assinatura);
  end loop;
end $$;
commit;
