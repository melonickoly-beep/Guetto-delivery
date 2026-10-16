-- Combo fixo: 1 vodka, 1 suco, 1 gelo potável e 3 copos com canudo.
-- As funções existentes de pedidos são preservadas, incluindo reabertura.
begin;

create or replace function public.componentes_combo_smirnoff()
returns table (produto_id uuid, quantidade integer)
language sql immutable set search_path = public as $$
  values
    ('ad5a9fc1-2e7a-4d81-80cd-256953c30142'::uuid, 1),
    ('a8603cba-5779-4437-a1c8-8a1ce4747f6f'::uuid, 1),
    ('bc7c756d-2504-4b4c-a16e-ab735b878ced'::uuid, 1),
    ('6ba865f2-1e6d-42c9-8185-8df23ed93af9'::uuid, 3);
$$;
revoke all on function public.componentes_combo_smirnoff() from public;

create or replace function public.estoque_combo_smirnoff()
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(min(case when p.disponivel then greatest(p.estoque, 0) / c.quantidade else 0 end), 0)
  from public.componentes_combo_smirnoff() c
  left join public.produtos p on p.id = c.produto_id;
$$;
revoke all on function public.estoque_combo_smirnoff() from public;

create or replace function public.sincronizar_estoque_combo_smirnoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.componentes_combo_smirnoff()
    where produto_id = case when tg_op = 'DELETE' then old.id else new.id end
  ) then
    return null;
  end if;
  perform 1 from public.produtos
   where id = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10' for update;
  update public.produtos
     set estoque = public.estoque_combo_smirnoff()
   where id = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10'
     and estoque is distinct from public.estoque_combo_smirnoff();
  return null;
end;
$$;
revoke all on function public.sincronizar_estoque_combo_smirnoff() from public;

-- Inclui mudanças de disponibilidade e exclusão de um componente.
create or replace trigger sincronizar_estoque_combo_smirnoff
after insert or update or delete on public.produtos
for each row execute function public.sincronizar_estoque_combo_smirnoff();

create or replace function public.movimentar_componentes_combo_smirnoff(p_quantidade integer, p_repor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_componente record;
  v_produto public.produtos%rowtype;
  v_consumo integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_repor is null then
    raise exception 'Quantidade inválida para o Combo Smirnoff';
  end if;
  -- Ordem estável de bloqueios; qualquer erro desfaz o pedido inteiro.
  for v_componente in select * from public.componentes_combo_smirnoff() order by produto_id loop
    select * into v_produto from public.produtos where id = v_componente.produto_id for update;
    if not found then
      raise exception 'Componente do Combo Smirnoff não encontrado: %', v_componente.produto_id;
    end if;
    v_consumo := p_quantidade * v_componente.quantidade;
    if not p_repor and (not v_produto.disponivel or v_produto.estoque < v_consumo) then
      raise exception 'Estoque insuficiente para %', v_produto.nome;
    end if;
    update public.produtos
       set estoque = estoque + case when p_repor then v_consumo else -v_consumo end
     where id = v_produto.id;
  end loop;
end;
$$;
revoke all on function public.movimentar_componentes_combo_smirnoff(integer, boolean) from public;

do $migration$
declare
  v_definicao text;
  v_alvo text := 'if v_produto.nome like ''Combo %'' then';
  v_marcador text := '-- combo-smirnoff-componentes-v1';
begin
  v_definicao := pg_get_functiondef('public.atualizar_status_pedido_seguro(uuid,text)'::regprocedure);
  if position(v_marcador in v_definicao) = 0 then
    if (length(v_definicao) - length(replace(v_definicao, v_alvo, ''))) / length(v_alvo) <> 2 then
      raise exception 'Função de estoque mudou. Revise antes de aplicar.';
    end if;
    v_definicao := replace(v_definicao, v_alvo, $patch$
      -- combo-smirnoff-componentes-v1
      if v_produto.id = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10'::uuid then
        perform public.movimentar_componentes_combo_smirnoff(v_quantidade, p_status = 'cancelado');
        continue;
      end if;
      if v_produto.nome like 'Combo %' then
    $patch$);
    execute v_definicao;
  end if;
end;
$migration$;

-- Ignora escolhas de combos antigos enviadas por um cliente desatualizado.
-- O combo fixo nunca deve movimentar energéticos ou gelos de sabor.
create or replace function public.normalizar_itens_combo_smirnoff()
returns trigger language plpgsql set search_path = public as $$
begin
  if jsonb_typeof(new.itens) = 'array' then
    select jsonb_agg(case
      when item->>'produto_id' = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10'
        then item - 'escolhas_combo'
      else item end order by ordem)
      into new.itens
      from jsonb_array_elements(new.itens) with ordinality as itens(item, ordem);
  end if;
  return new;
end;
$$;
revoke all on function public.normalizar_itens_combo_smirnoff() from public;
create or replace trigger normalizar_itens_combo_smirnoff
before insert or update of itens on public.pedidos
for each row execute function public.normalizar_itens_combo_smirnoff();

-- O vínculo é multicomponente, sem usar o vínculo legado de um destilado só.
update public.produtos set produto_base_id = null, estoque = 0
where id = 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10';
commit;
