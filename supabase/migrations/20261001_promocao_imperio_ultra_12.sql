-- Império Ultra: cada 12 unidades físicas recebem o preço da caixa cadastrada.
-- Preserva embalagens, histórico, estoque e a promoção das sedas.
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
  v_total numeric := 0;
  v_itens jsonb := '[]'::jsonb;
  v_unidades_ultra integer := 0;
  v_acumuladas_ultra integer := 0;
  v_fator integer;
  v_preco_unidade numeric;
  v_preco_caixa numeric;
  v_total_ultra numeric;
begin
  if jsonb_typeof(new.itens) <> 'array' then return new; end if;

  select max(preco) filter (where unidades_por_venda = 1),
         max(preco) filter (where unidades_por_venda = 12)
    into v_preco_unidade, v_preco_caixa
    from public.produtos
   where grupo_estoque = 'cerveja-imperio-ultra-long-neck';

  for v_item in select value from jsonb_array_elements(new.itens)
  loop
    select unidades_por_venda into v_fator from public.produtos
     where id::text = v_item->>'produto_id'
       and grupo_estoque = 'cerveja-imperio-ultra-long-neck'
       and unidades_por_venda in (1, 6, 12);
    v_unidades_ultra := v_unidades_ultra + coalesce(v_fator, 0) *
      greatest(coalesce((v_item->>'quantidade')::integer, 0), 0);
  end loop;
  v_total_ultra := floor(v_unidades_ultra / 12.0) * v_preco_caixa +
    mod(v_unidades_ultra, 12) * v_preco_unidade;

  for v_item in select value from jsonb_array_elements(new.itens)
  loop
    v_nome := regexp_replace(lower(trim(coalesce(v_item->>'nome', ''))), '\s+', ' ', 'g');
    v_quantidade := greatest(coalesce((v_item->>'quantidade')::integer, 0), 0);
    v_preco := greatest(coalesce((v_item->>'preco_unitario')::numeric, 0), 0);
    select unidades_por_venda into v_fator from public.produtos
     where id::text = v_item->>'produto_id'
       and grupo_estoque = 'cerveja-imperio-ultra-long-neck'
       and unidades_por_venda in (1, 6, 12);

    if v_fator is not null and v_unidades_ultra > 0 and v_total_ultra is not null then
      v_subtotal := round(v_total_ultra * (v_acumuladas_ultra + v_quantidade * v_fator) / v_unidades_ultra, 2) -
        round(v_total_ultra * v_acumuladas_ultra / v_unidades_ultra, 2);
      v_acumuladas_ultra := v_acumuladas_ultra + v_quantidade * v_fator;
    elsif v_nome in ('seda zomo', 'seda zomo marrom', 'seda zomo slim branca') then
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
