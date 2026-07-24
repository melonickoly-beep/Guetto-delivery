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
  v_total numeric := 0;
begin
  if jsonb_typeof(new.itens) <> 'array' then
    return new;
  end if;

  for v_item in select value from jsonb_array_elements(new.itens)
  loop
    v_nome := lower(trim(coalesce(v_item->>'nome', '')));
    v_quantidade := greatest(coalesce((v_item->>'quantidade')::integer, 0), 0);
    v_preco := greatest(coalesce((v_item->>'preco_unitario')::numeric, 0), 0);

    if v_nome = 'seda zomo' then
      v_total := v_total
        + (floor(v_quantidade / 3.0) * 10)
        + (mod(v_quantidade, 3) * v_preco);
    else
      v_total := v_total + (v_quantidade * v_preco);
    end if;
  end loop;

  new.total := v_total;
  return new;
end;
$$;

drop trigger if exists aplicar_promocoes_no_total
  on public.pedidos;

create trigger aplicar_promocoes_no_total
before insert or update of itens
on public.pedidos
for each row
execute function public.calcular_total_promocional_pedido();
