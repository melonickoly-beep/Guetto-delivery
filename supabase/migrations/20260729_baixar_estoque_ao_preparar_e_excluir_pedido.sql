-- O pedido novo apenas registra os itens. O estoque passa a ser movimentado
-- quando o administrador confirma o preparo.

alter table public.pedidos
  add column if not exists estoque_baixado boolean not null default false;

-- Pedidos criados antes desta migração já tiveram o estoque baixado na criação.
update public.pedidos
set estoque_baixado = (status <> 'cancelado')
where estoque_baixado = false;

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
  v_quantidade integer;
  v_total numeric := 0;
  v_itens_validados jsonb := '[]'::jsonb;
  v_pedido_id uuid;
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
       and disponivel = true;

    if not found then
      raise exception 'Produto indisponível';
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
    pagamento, tempo_entrega, observacao, status, estoque_baixado
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
    'novo',
    false
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

create or replace function public.atualizar_status_pedido_seguro(
  p_pedido_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item jsonb;
  v_produto public.produtos%rowtype;
  v_base public.produtos%rowtype;
  v_energetico public.produtos%rowtype;
  v_quantidade integer;
  v_consumo integer;
  v_escolha text;
  v_estoque_opcao integer;
begin
  if p_status not in (
    'novo',
    'em_preparo',
    'saiu_para_entrega',
    'concluido',
    'cancelado'
  ) then
    raise exception 'Status inválido';
  end if;

  select *
    into v_pedido
    from public.pedidos
   where id = p_pedido_id
   for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_pedido.status = 'cancelado' and p_status <> 'cancelado' then
    raise exception 'Pedido cancelado não pode ser reaberto';
  end if;

  if p_status in ('saiu_para_entrega', 'concluido')
     and not v_pedido.estoque_baixado then
    raise exception 'Coloque o pedido em preparo antes de avançar';
  end if;

  if p_status = 'novo' and v_pedido.estoque_baixado then
    raise exception 'Pedido em preparo não pode voltar para novo';
  end if;

  -- A primeira confirmação de preparo baixa todo o pedido em uma transação.
  if p_status = 'em_preparo' and not v_pedido.estoque_baixado then
    for v_item in select value from jsonb_array_elements(v_pedido.itens)
    loop
      v_quantidade := greatest((v_item->>'quantidade')::integer, 1);

      select *
        into v_produto
        from public.produtos
       where id = (v_item->>'produto_id')::uuid
         and disponivel = true
       for update;

      if not found then
        raise exception 'Produto indisponível: %', coalesce(v_item->>'nome', '');
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
          raise exception 'Estoque insuficiente para energético %',
            coalesce(v_escolha, '');
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
          raise exception 'Estoque insuficiente para Askov %',
            coalesce(v_escolha, '');
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
          v_estoque_opcao := coalesce(
            (v_base.estoque_opcoes->>v_escolha)::integer,
            0
          );
          if v_escolha is null or v_estoque_opcao < v_quantidade then
            raise exception 'Estoque insuficiente para Jack Daniel''s %',
              coalesce(v_escolha, '');
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
        v_consumo := v_quantidade * greatest(
          coalesce(v_produto.unidades_por_venda, 1),
          1
        );
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
          v_estoque_opcao := coalesce(
            (v_produto.estoque_opcoes->>v_escolha)::integer,
            0
          );
          if v_escolha is null or v_estoque_opcao < v_quantidade then
            raise exception 'Estoque insuficiente para % %',
              v_produto.nome, coalesce(v_escolha, '');
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
    end loop;

    v_pedido.estoque_baixado := true;
  end if;

  -- Cancelar só repõe pedidos cujo estoque chegou a ser baixado.
  if p_status = 'cancelado' and v_pedido.estoque_baixado then
    for v_item in select value from jsonb_array_elements(v_pedido.itens)
    loop
      v_quantidade := greatest((v_item->>'quantidade')::integer, 1);

      select *
        into v_produto
        from public.produtos
       where id = (v_item->>'produto_id')::uuid
       for update;

      if not found then
        continue;
      end if;

      if v_produto.nome like 'Combo %' then
        v_escolha := v_item->'escolhas_combo'->>'energetico';
        update public.produtos
           set estoque = estoque + v_quantidade
         where nome = 'Furioso 2L - ' || v_escolha;
      end if;

      if v_produto.nome = 'Combo Askov' then
        v_escolha := v_item->'escolhas_combo'->>'askov';
        update public.produtos
           set estoque = estoque + v_quantidade
         where nome = 'Askov 1L - ' || v_escolha;

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
         for update;

        if found then
          if v_base.estoque_opcoes is not null then
            v_escolha := v_item->'escolhas_combo'->>'whisky';
            v_estoque_opcao := coalesce(
              (v_base.estoque_opcoes->>v_escolha)::integer,
              0
            );

            update public.produtos
               set estoque_opcoes = jsonb_set(
                 estoque_opcoes,
                 array[v_escolha],
                 to_jsonb(v_estoque_opcao + v_quantidade)
               )
             where id = v_base.id;
          end if;

          update public.produtos
             set estoque = estoque + v_quantidade
           where id = v_base.id
           returning * into v_base;

          update public.produtos
             set estoque = v_base.estoque
           where produto_base_id = v_base.id;
        end if;
      elsif v_produto.grupo_estoque is not null
            and v_produto.estoque_unidades is not null then
        v_consumo := v_quantidade * greatest(
          coalesce(v_produto.unidades_por_venda, 1),
          1
        );

        update public.produtos
           set estoque_unidades = estoque_unidades + v_consumo
         where grupo_estoque = v_produto.grupo_estoque;
      else
        if v_produto.estoque_opcoes is not null then
          v_escolha := v_item->'escolhas_combo'->>'sabor';
          v_estoque_opcao := coalesce(
            (v_produto.estoque_opcoes->>v_escolha)::integer,
            0
          );

          update public.produtos
             set estoque = estoque + v_quantidade,
                 estoque_opcoes = jsonb_set(
                   estoque_opcoes,
                   array[v_escolha],
                   to_jsonb(v_estoque_opcao + v_quantidade)
                 )
           where id = v_produto.id
           returning * into v_produto;
        else
          update public.produtos
             set estoque = estoque + v_quantidade
           where id = v_produto.id
           returning * into v_produto;
        end if;

        update public.produtos
           set estoque = v_produto.estoque
         where produto_base_id = v_produto.id;
      end if;
    end loop;

    v_pedido.estoque_baixado := false;
  end if;

  update public.pedidos
     set status = p_status,
         estoque_baixado = v_pedido.estoque_baixado
   where id = p_pedido_id;
end;
$$;

revoke all on function public.atualizar_status_pedido_seguro(uuid, text)
  from public;

grant execute on function public.atualizar_status_pedido_seguro(uuid, text)
  to service_role;

create or replace function public.excluir_pedido_seguro(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A chamada é atômica: se a exclusão falhar, a eventual reposição também
  -- será desfeita.
  perform public.atualizar_status_pedido_seguro(p_pedido_id, 'cancelado');
  delete from public.pedidos where id = p_pedido_id;
end;
$$;

revoke all on function public.excluir_pedido_seguro(uuid) from public;
grant execute on function public.excluir_pedido_seguro(uuid) to service_role;
