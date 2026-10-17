begin;
create table if not exists public.pedidos_idempotencia (
  chave uuid primary key,
  assinatura text not null,
  pedido_id uuid not null,
  criado_em timestamptz not null default now()
);
alter table public.pedidos_idempotencia enable row level security;
revoke all on public.pedidos_idempotencia from public, anon, authenticated;
grant select, insert on public.pedidos_idempotencia to service_role;

create or replace function public.criar_pedido_idempotente(
  p_chave uuid, p_assinatura text,
  p_cliente_nome text, p_telefone text, p_endereco text, p_referencia text,
  p_itens jsonb, p_pagamento jsonb, p_tempo_entrega integer, p_observacao text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_anterior public.pedidos_idempotencia%rowtype;
  v_pedido uuid;
begin
  if p_chave is null or p_assinatura is null or p_assinatura !~ '^[0-9a-f]{64}$' then
    raise exception 'Tentativa de pedido inválida';
  end if;
  -- Serializa tentativas concorrentes da mesma compra, inclusive entre servidores.
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
  select * into v_anterior from public.pedidos_idempotencia where chave=p_chave;
  if found then
    if v_anterior.assinatura<>p_assinatura then
      raise exception using errcode='22023',message='A tentativa já pertence a outro pedido';
    end if;
    return v_anterior.pedido_id;
  end if;
  v_pedido:=public.criar_pedido_seguro(p_cliente_nome,p_telefone,p_endereco,p_referencia,
    p_itens,p_pagamento,p_tempo_entrega,p_observacao);
  insert into public.pedidos_idempotencia(chave,assinatura,pedido_id)
    values(p_chave,p_assinatura,v_pedido);
  return v_pedido;
end;
$$;
revoke all on function public.criar_pedido_idempotente(uuid,text,text,text,text,text,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.criar_pedido_idempotente(uuid,text,text,text,text,text,jsonb,jsonb,integer,text) to service_role;
commit;
