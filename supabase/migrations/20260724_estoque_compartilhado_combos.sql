alter table public.produtos
  add column if not exists produto_base_id uuid references public.produtos(id),
  add column if not exists estoque_opcoes jsonb,
  add column if not exists grupo_estoque text,
  add column if not exists unidades_por_venda integer default 1,
  add column if not exists estoque_unidades integer;

update public.produtos
set produto_base_id = case id
  when '16a1f730-d343-4e6f-87e6-15d82f628b98'::uuid then 'a9e609e2-ae23-42b7-8227-5e7f48608ded'::uuid
  when 'd0dd6230-5ccc-4efe-90d0-445a60688239'::uuid then '17e4254f-0c03-4837-8c5b-6bd179d624e3'::uuid
  when '199ed921-d910-400e-a0ab-4c97230aa4a5'::uuid then '4708b2b5-e167-4a2f-afff-b8dcd89c050f'::uuid
  when 'be9c5d74-7685-401f-af65-8afcd169f666'::uuid then 'c294e280-4c3f-4664-bce6-dbdaca9f5056'::uuid
  when 'aaebcf45-14cf-43c8-bda8-29b477c703f8'::uuid then '23c06ad6-b433-4843-9c52-82da8880ca84'::uuid
  when '7b90bf43-1a66-4c64-81e3-655e3dcbbae7'::uuid then 'c068e7e6-600e-46e6-9287-aec896f3faeb'::uuid
  else produto_base_id
end
where id in (
  '16a1f730-d343-4e6f-87e6-15d82f628b98',
  'd0dd6230-5ccc-4efe-90d0-445a60688239',
  '199ed921-d910-400e-a0ab-4c97230aa4a5',
  'be9c5d74-7685-401f-af65-8afcd169f666',
  'aaebcf45-14cf-43c8-bda8-29b477c703f8',
  '7b90bf43-1a66-4c64-81e3-655e3dcbbae7'
);

update public.produtos
set estoque_opcoes = jsonb_build_object(
  'Tradicional', 1,
  'Fire', 1,
  'Maçã Verde', 1,
  'Mel', 1
)
where id = '17e4254f-0c03-4837-8c5b-6bd179d624e3';

update public.produtos combo
set estoque = base.estoque
from public.produtos base
where combo.produto_base_id = base.id;

update public.produtos
set estoque = (
  select coalesce(sum(estoque), 0)
  from public.produtos
  where nome like 'Askov 1L - %'
)
where id = '1c90c146-c8fc-4aa1-a8cd-0af5f0aea701';

create or replace function public.criar_pedido_seguro(
  p_cliente_nome text,
  p_telefone text,
  p_endereco text,
  p_referencia text,
  p_itens jsonb,
  p_pagamento jsonb,
  p_tempo_entrega integer,
  p_observacao text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_produto public.produtos%rowtype;
  v_base public.produtos%rowtype;
  v_energetico public.produtos%rowtype;
  v_quantidade integer;
  v_consumo integer;
  v_total numeric := 0;
  v_itens_validados jsonb := '[]'::jsonb;
  v_pedido_id uuid;
  v_escolha text;
  v_estoque_opcao integer;
begin
  if nullif(trim(p_cliente_nome), '') is null
     or nullif(trim(p_telefone), '') is null
     or nullif(trim(p_endereco), '') is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0
     or jsonb_array_length(p_itens) > 50 then
    raise exception 'Dados do pedido inválidos';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_quantidade := (v_item->>'quantidade')::integer;
    if v_quantidade < 1 or v_quantidade > 100 then
      raise exception 'Quantidade inválida';
    end if;

    select *
      into v_produto
      from public.produtos
     where id = (v_item->>'produto_id')::uuid
       and disponivel = true
     for update;

    if not found then
      raise exception 'Produto indisponível';
    end if;

    if v_produto.nome like 'Combo %' then
      v_escolha := v_item->'escolhas_combo'->>'energetico';
      select *
        into v_energetico
        from public.produtos
       where nome = 'Furioso 2L - ' || v_escolha
         and disponivel = true
       for update;

      if not found or v_energetico.estoque < v_quantidade then
        raise exception 'Estoque insuficiente para energético %', coalesce(v_escolha, '');
      end if;

      update public.produtos
         set estoque = estoque - v_quantidade
       where id = v_energetico.id;
    end if;

    if v_produto.nome = 'Combo Askov' then
      v_escolha := v_item->'escolhas_combo'->>'askov';
      select *
        into v_base
        from public.produtos
       where nome = 'Askov 1L - ' || v_escolha
         and disponivel = true
       for update;

      if not found or v_base.estoque < v_quantidade then
        raise exception 'Estoque insuficiente para Askov %', coalesce(v_escolha, '');
      end if;

      update public.produtos
         set estoque = estoque - v_quantidade
       where id = v_base.id;

      update public.produtos
         set estoque = (
           select coalesce(sum(estoque), 0)
           from public.produtos
           where nome like 'Askov 1L - %'
         )
       where id = v_produto.id;
    elsif v_produto.produto_base_id is not null then
      select *
        into v_base
        from public.produtos
       where id = v_produto.produto_base_id
         and disponivel = true
       for update;

      if not found or v_base.estoque < v_quantidade then
        raise exception 'Estoque insuficiente para %', v_produto.nome;
      end if;

      if v_base.estoque_opcoes is not null then
        v_escolha := v_item->'escolhas_combo'->>'whisky';
        v_estoque_opcao := coalesce((v_base.estoque_opcoes->>v_escolha)::integer, 0);
        if v_escolha is null or v_estoque_opcao < v_quantidade then
          raise exception 'Estoque insuficiente para Jack Daniel''s %', coalesce(v_escolha, '');
        end if;

        update public.produtos
           set estoque_opcoes = jsonb_set(
             estoque_opcoes,
             array[v_escolha],
             to_jsonb(v_estoque_opcao - v_quantidade)
           )
         where id = v_base.id;
      end if;

      update public.produtos
         set estoque = estoque - v_quantidade
       where id = v_base.id;

      update public.produtos
         set estoque = v_base.estoque - v_quantidade
       where produto_base_id = v_base.id;
    elsif v_produto.grupo_estoque is not null
          and v_produto.estoque_unidades is not null then
      v_consumo := v_quantidade * greatest(coalesce(v_produto.unidades_por_venda, 1), 1);
      if v_produto.estoque_unidades < v_consumo then
        raise exception 'Estoque insuficiente para %', v_produto.nome;
      end if;

      update public.produtos
         set estoque_unidades = estoque_unidades - v_consumo
       where grupo_estoque = v_produto.grupo_estoque;
    else
      if v_produto.estoque < v_quantidade then
        raise exception 'Estoque insuficiente para %', v_produto.nome;
      end if;

      if v_produto.estoque_opcoes is not null then
        v_escolha := v_item->'escolhas_combo'->>'sabor';
        v_estoque_opcao := coalesce((v_produto.estoque_opcoes->>v_escolha)::integer, 0);
        if v_escolha is null or v_estoque_opcao < v_quantidade then
          raise exception 'Estoque insuficiente para Jack Daniel''s %', coalesce(v_escolha, '');
        end if;

        update public.produtos
           set estoque = estoque - v_quantidade,
               estoque_opcoes = jsonb_set(
                 estoque_opcoes,
                 array[v_escolha],
                 to_jsonb(v_estoque_opcao - v_quantidade)
               )
         where id = v_produto.id;
      else
        update public.produtos
           set estoque = estoque - v_quantidade
         where id = v_produto.id;
      end if;

      update public.produtos
         set estoque = v_produto.estoque - v_quantidade
       where produto_base_id = v_produto.id;
    end if;

    v_total := v_total + (v_produto.preco * v_quantidade);
    v_itens_validados := v_itens_validados || jsonb_build_array(
      jsonb_build_object(
        'produto_id', v_produto.id,
        'nome', v_produto.nome,
        'quantidade', v_quantidade,
        'preco_unitario', v_produto.preco,
        'escolhas_combo', v_item->'escolhas_combo'
      )
    );
  end loop;

  insert into public.pedidos (
    cliente_nome, telefone, endereco, referencia, itens, total,
    pagamento, tempo_entrega, observacao, status
  )
  values (
    left(trim(p_cliente_nome), 160),
    left(trim(p_telefone), 40),
    left(trim(p_endereco), 300),
    nullif(left(trim(coalesce(p_referencia, '')), 300), ''),
    v_itens_validados,
    v_total,
    coalesce(p_pagamento, '[]'::jsonb),
    greatest(coalesce(p_tempo_entrega, 20), 1),
    left(coalesce(p_observacao, ''), 500),
    'novo'
  )
  returning id into v_pedido_id;

  return v_pedido_id;
end;
$$;

revoke all on function public.criar_pedido_seguro(
  text, text, text, text, jsonb, jsonb, integer, text
) from public;

grant execute on function public.criar_pedido_seguro(
  text, text, text, text, jsonb, jsonb, integer, text
) to anon, authenticated;
