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

  if p_status = 'cancelado' and v_pedido.status <> 'cancelado' then
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
  end if;

  update public.pedidos
     set status = p_status
   where id = p_pedido_id;
end;
$$;

revoke all on function public.atualizar_status_pedido_seguro(uuid, text)
  from public;

grant execute on function public.atualizar_status_pedido_seguro(uuid, text)
  to service_role;
