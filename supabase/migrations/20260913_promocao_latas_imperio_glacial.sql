-- Os grupos completos de 12 já chegam como caixas pela API.
-- Aplicar 3 por 10 às latas restantes da mesma marca e guardar o subtotal.
create or replace function public.calcular_total_promocional_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item jsonb;
  v_nome text;
  v_quantidade integer;
  v_preco numeric;
  v_subtotal numeric;
  v_promocional boolean;
  v_total numeric := 0;
  v_itens jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(new.itens) <> 'array' then
    return new;
  end if;

  for v_item in select value from jsonb_array_elements(new.itens)
  loop
    v_nome := lower(trim(coalesce(v_item->>'nome', '')));
    v_quantidade := greatest(coalesce((v_item->>'quantidade')::integer, 0), 0);
    v_preco := greatest(coalesce((v_item->>'preco_unitario')::numeric, 0), 0);
    select exists (
      select 1 from public.produtos p
      where p.id::text = v_item->>'produto_id'
        and p.tipo_venda = 'avulso'
        and lower(p.nome) ~ '\mlata\M'
        and translate(lower(trim(p.nome)), 'é', 'e') ~ '^(imperio\s+puro\s+malte|glacial)\M'
    ) into v_promocional;

    if v_nome = 'seda zomo' or v_promocional then
      v_subtotal := floor(v_quantidade / 3.0) * 10 + mod(v_quantidade, 3) * v_preco;
    else
      v_subtotal := v_quantidade * v_preco;
    end if;
    v_total := v_total + v_subtotal;
    v_itens := v_itens || jsonb_build_array(v_item || jsonb_build_object('subtotal', v_subtotal));
  end loop;

  new.itens := v_itens;
  new.total := v_total;
  return new;
end;
$$;
