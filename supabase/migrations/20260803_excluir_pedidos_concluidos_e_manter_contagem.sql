-- Pedidos concluídos não precisam manter dados pessoais ou itens.
-- Guardamos somente uma contagem anônima por dia para o painel administrativo.

create table if not exists public.contagem_pedidos_concluidos (
  data_pedido date primary key,
  quantidade bigint not null default 0 check (quantidade >= 0),
  atualizado_em timestamptz not null default now()
);

alter table public.contagem_pedidos_concluidos enable row level security;

revoke all on table public.contagem_pedidos_concluidos
  from public, anon, authenticated;
grant select on table public.contagem_pedidos_concluidos to service_role;

-- Preserva a contagem dos pedidos que já estavam concluídos e remove seus dados.
insert into public.contagem_pedidos_concluidos (data_pedido, quantidade)
select
  (created_at at time zone 'America/Sao_Paulo')::date,
  count(*)
from public.pedidos
where status = 'concluido'
group by (created_at at time zone 'America/Sao_Paulo')::date
on conflict (data_pedido) do update
set quantidade = public.contagem_pedidos_concluidos.quantidade + excluded.quantidade,
    atualizado_em = now();

delete from public.pedidos where status = 'concluido';

create or replace function public.remover_pedido_concluido_e_contar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from 'concluido' and new.status = 'concluido' then
    insert into public.contagem_pedidos_concluidos (data_pedido, quantidade)
    values (
      (new.created_at at time zone 'America/Sao_Paulo')::date,
      1
    )
    on conflict (data_pedido) do update
    set quantidade = public.contagem_pedidos_concluidos.quantidade + 1,
        atualizado_em = now();

    delete from public.pedidos where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists excluir_pedido_apos_conclusao on public.pedidos;
create trigger excluir_pedido_apos_conclusao
after update of status on public.pedidos
for each row
when (new.status = 'concluido')
execute function public.remover_pedido_concluido_e_contar();

create or replace function public.obter_resumo_pedidos_hoje()
returns table (
  data_referencia date,
  pedidos_ativos bigint,
  pedidos_concluidos bigint,
  pedidos_total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ativos bigint;
  v_concluidos bigint;
begin
  select count(*)
    into v_ativos
    from public.pedidos
   where created_at >= (v_data::timestamp at time zone 'America/Sao_Paulo')
     and created_at < ((v_data + 1)::timestamp at time zone 'America/Sao_Paulo');

  select coalesce(quantidade, 0)
    into v_concluidos
    from public.contagem_pedidos_concluidos
   where data_pedido = v_data;

  v_concluidos := coalesce(v_concluidos, 0);

  return query
  select v_data, v_ativos, v_concluidos, v_ativos + v_concluidos;
end;
$$;

revoke all on function public.obter_resumo_pedidos_hoje() from public;
grant execute on function public.obter_resumo_pedidos_hoje() to service_role;
