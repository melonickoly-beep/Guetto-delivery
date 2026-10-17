-- Completa o estoque compartilhado dos combos, sem alterar saldos dos avulsos.
begin;

alter table public.pedidos add column if not exists complementos_combos_baixados jsonb not null default '[]'::jsonb;

create or replace function public.calcular_estoque_compartilhado_combo(p_combo public.produtos)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_base public.produtos%rowtype;
  v_bebida integer := 0;
  v_energetico integer := 0;
  v_gelo integer := 0;
  v_copo integer := 0;
begin
  if p_combo.id = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10' then
    return public.estoque_combo_smirnoff();
  end if;
  if lower(trim(p_combo.nome)) = 'combo askov' then
    select coalesce(sum(greatest(estoque,0)),0)::integer into v_bebida
      from public.produtos where nome like 'Askov 1L - %' and disponivel;
  elsif p_combo.produto_base_id is not null then
    select * into v_base from public.produtos where id = p_combo.produto_base_id;
    if found and v_base.disponivel then
      v_bebida := greatest(v_base.estoque,0);
      if v_base.estoque_opcoes is not null then
        v_bebida := least(v_bebida,(select coalesce(sum(greatest(value::integer,0)),0)::integer from jsonb_each_text(v_base.estoque_opcoes)));
      end if;
    end if;
  end if;
  select coalesce(sum(greatest(estoque,0)),0)::integer into v_energetico
    from public.produtos where nome like 'Furioso 2L - %' and disponivel;
  select coalesce(max(least(greatest(p.estoque,0),case when p.estoque_opcoes is null then greatest(p.estoque,0)
    else (select coalesce(sum(greatest(value::integer,0)),0)::integer from jsonb_each_text(p.estoque_opcoes)) end)/6),0)
    into v_gelo from public.produtos p where p.id='27ba1256-daa8-42b6-a093-3728cb6a2a23' and p.disponivel;
  select coalesce(max(greatest(estoque,0)/3),0) into v_copo
    from public.produtos where id='6ba865f2-1e6d-42c9-8185-8df23ed93af9' and disponivel;
  return least(v_bebida,v_energetico,v_gelo,v_copo);
end;
$$;
revoke all on function public.calcular_estoque_compartilhado_combo(public.produtos) from public;

create or replace function public.recalcular_estoques_combos()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.produtos p set estoque=public.calcular_estoque_compartilhado_combo(p)
    where lower(trim(p.nome)) like 'combo %'
      and p.estoque is distinct from public.calcular_estoque_compartilhado_combo(p);
end;
$$;
revoke all on function public.recalcular_estoques_combos() from public;

create or replace function public.derivar_estoque_combo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(trim(new.nome)) like 'combo %' then
    new.estoque := public.calcular_estoque_compartilhado_combo(new);
  end if;
  return new;
end;
$$;
revoke all on function public.derivar_estoque_combo() from public;
create or replace trigger derivar_estoque_combo before insert or update on public.produtos
for each row execute function public.derivar_estoque_combo();

create or replace function public.sincronizar_combo_apos_estoque_produto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op='DELETE' then
    if lower(trim(old.nome)) not like 'combo %' then perform public.recalcular_estoques_combos(); end if;
    return old;
  end if;
  if lower(trim(new.nome)) not like 'combo %' then perform public.recalcular_estoques_combos(); end if;
  return new;
end;
$$;
revoke all on function public.sincronizar_combo_apos_estoque_produto() from public;
create or replace trigger sincronizar_combo_apos_estoque_produto after insert or update or delete on public.produtos
for each row execute function public.sincronizar_combo_apos_estoque_produto();

create or replace function public.movimentar_complemento_combo(p_id uuid,p_quantidade integer,p_opcoes jsonb,p_repor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_produto public.produtos%rowtype;
  v_sabor text;
  v_quantidade integer;
  v_saldo integer;
begin
  if p_quantidade is null or p_quantidade<1 or p_repor is null then raise exception 'Quantidade inválida de componente'; end if;
  select * into v_produto from public.produtos where id=p_id for update;
  if not found then raise exception 'Componente do combo não encontrado: %',p_id; end if;
  if not p_repor and (not v_produto.disponivel or v_produto.estoque<p_quantidade) then
    raise exception 'Estoque insuficiente para %',v_produto.nome;
  end if;
  if v_produto.estoque_opcoes is not null then
    if p_opcoes is null or jsonb_typeof(p_opcoes)<>'object' then raise exception 'Escolha os sabores de %',v_produto.nome; end if;
    for v_sabor,v_quantidade in select key,value::integer from jsonb_each_text(p_opcoes) loop
      v_saldo:=coalesce((v_produto.estoque_opcoes->>v_sabor)::integer,0);
      if not p_repor and v_saldo<v_quantidade then raise exception 'Estoque insuficiente para % %',v_produto.nome,v_sabor; end if;
      v_produto.estoque_opcoes:=jsonb_set(v_produto.estoque_opcoes,array[v_sabor],to_jsonb(v_saldo+case when p_repor then v_quantidade else -v_quantidade end),true);
    end loop;
  end if;
  update public.produtos set estoque=estoque+case when p_repor then p_quantidade else -p_quantidade end,
    estoque_opcoes=v_produto.estoque_opcoes where id=p_id;
end;
$$;
revoke all on function public.movimentar_complemento_combo(uuid,integer,jsonb,boolean) from public;

create or replace function public.movimentar_complementos_dos_combos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_componente jsonb;
  v_produto public.produtos%rowtype;
  v_total integer:=0;
  v_quantidade integer;
  v_sabor text;
  v_sabores jsonb:='{}'::jsonb;
  v_registro jsonb:='[]'::jsonb;
begin
  if new.estoque_baixado is not distinct from old.estoque_baixado then return new; end if;
  if new.estoque_baixado then
    for v_item in select value from jsonb_array_elements(new.itens) loop
      select * into v_produto from public.produtos where id=(v_item->>'produto_id')::uuid;
      if found and lower(trim(v_produto.nome)) like 'combo %' and v_produto.id<>'de2675a7-665c-4de5-a0c9-ef96e3ee9c10' then
        if jsonb_typeof(v_item->'escolhas_combo'->'gelos') is distinct from 'array' then raise exception 'Escolha os seis gelos do combo'; end if;
        if jsonb_array_length(v_item->'escolhas_combo'->'gelos')<>6 then raise exception 'Escolha os seis gelos do combo'; end if;
        v_quantidade:=greatest((v_item->>'quantidade')::integer,1);
        v_total:=v_total+v_quantidade;
        for v_sabor in select jsonb_array_elements_text(v_item->'escolhas_combo'->'gelos') loop
          if nullif(trim(v_sabor),'') is null then raise exception 'Sabor de gelo inválido'; end if;
          v_sabores:=jsonb_set(v_sabores,array[v_sabor],to_jsonb(coalesce((v_sabores->>v_sabor)::integer,0)+v_quantidade),true);
        end loop;
      end if;
    end loop;
    if v_total>0 then
      v_registro:=jsonb_build_array(
        jsonb_build_object('produto_id','27ba1256-daa8-42b6-a093-3728cb6a2a23','quantidade',v_total*6,'opcoes',v_sabores),
        jsonb_build_object('produto_id','6ba865f2-1e6d-42c9-8185-8df23ed93af9','quantidade',v_total*3,'opcoes',null));
      for v_componente in select value from jsonb_array_elements(v_registro) order by value->>'produto_id' loop
        perform public.movimentar_complemento_combo((v_componente->>'produto_id')::uuid,(v_componente->>'quantidade')::integer,nullif(v_componente->'opcoes','null'::jsonb),false);
      end loop;
    end if;
    new.complementos_combos_baixados:=v_registro;
  else
    -- Pedidos antigos não possuíam essa baixa; não repor itens que nunca saíram.
    for v_componente in select value from jsonb_array_elements(old.complementos_combos_baixados) order by value->>'produto_id' loop
      perform public.movimentar_complemento_combo((v_componente->>'produto_id')::uuid,(v_componente->>'quantidade')::integer,nullif(v_componente->'opcoes','null'::jsonb),true);
    end loop;
    new.complementos_combos_baixados:='[]'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.movimentar_complementos_dos_combos() from public;
-- A regra completa substitui a baixa isolada de gelos da migração anterior.
drop trigger if exists movimentar_gelos_dos_combos on public.pedidos;
create or replace trigger movimentar_complementos_dos_combos before update of estoque_baixado on public.pedidos
for each row execute function public.movimentar_complementos_dos_combos();

-- Ao cancelar Busca Brisa preparado antes da correção, só devolver o energético.
do $migration$
declare v_definicao text; v_alvo text:='elsif v_produto.produto_base_id is not null then';
begin
  v_definicao:=pg_get_functiondef('public.atualizar_status_pedido_seguro(uuid,text)'::regprocedure);
  if position('-- busca-brisa-historico-v1' in v_definicao)=0 then
    if (length(v_definicao)-length(replace(v_definicao,v_alvo,'')))/length(v_alvo)<>2 then raise exception 'Revise a função instalada de pedidos antes de aplicar'; end if;
    v_definicao:=replace(v_definicao,v_alvo,$patch$
      -- busca-brisa-historico-v1
      elsif v_produto.produto_base_id is not null and (
        p_status<>'cancelado' or v_produto.id<>'1c1d1717-7ff3-4df1-8be2-0122a481ce96'::uuid
        or jsonb_array_length(v_pedido.complementos_combos_baixados)>0
      ) then
    $patch$);
    execute v_definicao;
  end if;
end;
$migration$;

update public.produtos set produto_base_id='5e2eb8f4-39a7-4406-8fd4-d6c354207c51'
where id='1c1d1717-7ff3-4df1-8be2-0122a481ce96';
select public.recalcular_estoques_combos();
commit;
