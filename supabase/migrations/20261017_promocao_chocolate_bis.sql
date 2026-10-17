-- Bis Original e Branco compartilham trios de R$ 18. Restantes: R$ 7.
-- Aplica depois do cálculo existente, preservando todas as outras promoções.
create or replace function public.aplicar_promocao_bis_itens(p_itens jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_item jsonb;
  v_quantidade integer;
  v_total_quantidade integer := 0;
  v_anteriores integer := 0;
  v_centavos numeric;
  v_subtotal numeric;
  v_itens jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_itens) <> 'array' then return p_itens; end if;
  select coalesce(sum(greatest((value->>'quantidade')::integer, 0)),0)
  into v_total_quantidade from jsonb_array_elements(p_itens)
  where value->>'produto_id' in ('5a645841-c7ba-4e40-ab85-ec7522b346c1','bcbf35d7-598e-4079-9168-5e526dcf974f');
  if v_total_quantidade = 0 then return p_itens; end if;
  v_centavos := (v_total_quantidade / 3) * 1800 + mod(v_total_quantidade,3) * 700;
  for v_item in select value from jsonb_array_elements(p_itens) loop
    if v_item->>'produto_id' in ('5a645841-c7ba-4e40-ab85-ec7522b346c1','bcbf35d7-598e-4079-9168-5e526dcf974f') then
      v_quantidade := greatest((v_item->>'quantidade')::integer,0);
      v_subtotal := (round(v_centavos * (v_anteriores + v_quantidade) / v_total_quantidade)
        - round(v_centavos * v_anteriores / v_total_quantidade)) / 100;
      v_item := v_item || jsonb_build_object('subtotal',v_subtotal);
      v_anteriores := v_anteriores + v_quantidade;
    end if;
    v_itens := v_itens || jsonb_build_array(v_item);
  end loop;
  return v_itens;
end;
$$;

create or replace function public.calcular_promocao_bis_pedido()
returns trigger language plpgsql set search_path = public as $$
declare
  v_itens jsonb;
  v_antes numeric;
  v_depois numeric;
begin
  v_itens := public.aplicar_promocao_bis_itens(new.itens);
  if v_itens is not distinct from new.itens then return new; end if;
  select sum(coalesce((value->>'subtotal')::numeric,(value->>'quantidade')::numeric * (value->>'preco_unitario')::numeric))
    into v_antes from jsonb_array_elements(new.itens);
  select sum(coalesce((value->>'subtotal')::numeric,(value->>'quantidade')::numeric * (value->>'preco_unitario')::numeric))
    into v_depois from jsonb_array_elements(v_itens);
  new.itens := v_itens;
  new.total := new.total + v_depois - v_antes;
  return new;
end;
$$;

create or replace trigger zz_aplicar_promocao_bis
before insert or update of itens on public.pedidos
for each row execute function public.calcular_promocao_bis_pedido();
