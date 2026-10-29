begin;
alter table public.pedidos_idempotencia add column if not exists resposta jsonb;
create or replace function public.criar_pedido_conferido(
  p_chave uuid, p_assinatura text, p_total numeric,
  p_cliente_nome text, p_telefone text, p_endereco text, p_referencia text,
  p_itens jsonb, p_pagamento jsonb, p_tempo_entrega integer, p_observacao text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_anterior public.pedidos_idempotencia%rowtype; v_id uuid; v_resposta jsonb;
begin
  if p_total is null or p_total < 0 then raise exception 'Total inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
  select * into v_anterior from public.pedidos_idempotencia where chave=p_chave;
  if found then
    if v_anterior.assinatura <> p_assinatura then raise exception 'A tentativa já pertence a outro pedido'; end if;
    if v_anterior.resposta is not null then return v_anterior.resposta; end if;
    select jsonb_build_object('id',id,'total',total,'itens',itens) into v_resposta from public.pedidos where id=v_anterior.pedido_id;
    return coalesce(v_resposta,jsonb_build_object('id',v_anterior.pedido_id,'arquivado',true));
  end if;
  v_id := public.criar_pedido_idempotente(p_chave,p_assinatura,p_cliente_nome,p_telefone,p_endereco,p_referencia,p_itens,p_pagamento,p_tempo_entrega,p_observacao);
  select jsonb_build_object('id',id,'total',total,'itens',itens) into v_resposta from public.pedidos where id=v_id;
  if v_resposta is null or round((v_resposta->>'total')::numeric,2) <> round(p_total,2) then
    -- A exceção desfaz pedido, triggers e chave: jamais deixa uma compra com preço diferente.
    raise exception using errcode='22023', message='Os preços mudaram. Atualize o catálogo e revise o pedido.';
  end if;
  update public.pedidos_idempotencia set resposta=v_resposta where chave=p_chave;
  return v_resposta;
end $$;
revoke all on function public.criar_pedido_conferido(uuid,text,numeric,text,text,text,text,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.criar_pedido_conferido(uuid,text,numeric,text,text,text,text,jsonb,jsonb,integer,text) to service_role;
-- Guarda somente a situação final, sem dados pessoais ou itens.
create table public.pedidos_situacao_final (
  pedido_id uuid primary key, status text not null check(status in ('concluido','cancelado')),
  atualizado_em timestamptz not null default now()
);
alter table public.pedidos_situacao_final enable row level security;
revoke all on public.pedidos_situacao_final from public,anon,authenticated;
grant select on public.pedidos_situacao_final to service_role;
create function public.preservar_situacao_final() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if old.status in ('concluido','cancelado') then
    insert into public.pedidos_situacao_final(pedido_id,status) values(old.id,old.status)
      on conflict(pedido_id) do update set status=excluded.status, atualizado_em=now();
  end if;
  return old;
end $$;
revoke all on function public.preservar_situacao_final() from public,anon,authenticated;
create trigger preservar_situacao_final before delete on public.pedidos
for each row execute function public.preservar_situacao_final();
commit;
