-- Executar em transação; cada cenário reverte inclusive o pedido de teste.
do $edges$
declare
  v_pedido uuid;
  v_hash text;
  v_depois text;
  v_falhou boolean;
  v_estoque integer;
  v_componente jsonb;
  v_itens jsonb := jsonb_build_array(jsonb_build_object(
    'produto_id','1c1d1717-7ff3-4df1-8be2-0122a481ce96','quantidade',1,
    'escolhas_combo',jsonb_build_object('energetico','Tradicional',
      'gelos',jsonb_build_array('Coco','Coco','Coco','Coco','Coco','Coco'))));
begin
  -- Falta de copos e falta do sabor escolhido devem reverter a baixa inteira.
  for v_estoque in 1..2 loop
    begin
      if v_estoque=1 then
        update public.produtos set estoque=2 where id='6ba865f2-1e6d-42c9-8185-8df23ed93af9';
      else
        update public.produtos set estoque_opcoes=jsonb_set(estoque_opcoes,'{Coco}','5') where id='27ba1256-daa8-42b6-a093-3728cb6a2a23';
      end if;
      v_pedido:=public.criar_pedido_seguro('TESTE REVERTIDO','00000000000','TESTE','',v_itens,'[]',20,'TESTE TRANSACIONAL');
      select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_hash from public.produtos;
      v_falhou:=false;
      begin
        perform public.atualizar_status_pedido_seguro(v_pedido,'em_preparo');
      exception when raise_exception then v_falhou:=true;
      end;
      assert v_falhou,'Impedir baixa sem todos os componentes';
      select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_depois from public.produtos;
      assert v_hash=v_depois,'Falha deve reverter todas as baixas';
      raise exception using errcode='Z0001',message='Reverter cenário';
    exception when sqlstate 'Z0001' then null;
    end;
  end loop;
  begin
    v_pedido:=public.criar_pedido_seguro('TESTE REVERTIDO','00000000000','TESTE','',v_itens,'[]',20,'TESTE TRANSACIONAL');
    perform public.atualizar_status_pedido_seguro(v_pedido,'em_preparo');
    select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_hash from public.produtos;
    perform public.atualizar_status_pedido_seguro(v_pedido,'em_preparo');
    select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_depois from public.produtos;
    assert v_hash=v_depois,'Repetir preparo não baixa novamente';
    -- Reproduzir pedido histórico: antes desta correção não saíam base, gelo nem copos.
    for v_componente in select value from public.pedidos p,jsonb_array_elements(p.complementos_combos_baixados) where p.id=v_pedido loop
      perform public.movimentar_complemento_combo((v_componente->>'produto_id')::uuid,(v_componente->>'quantidade')::integer,nullif(v_componente->'opcoes','null'::jsonb),true);
    end loop;
    update public.produtos set estoque=estoque+1 where id='5e2eb8f4-39a7-4406-8fd4-d6c354207c51';
    update public.pedidos set complementos_combos_baixados='[]' where id=v_pedido;
    select estoque into v_estoque from public.produtos where id='5e2eb8f4-39a7-4406-8fd4-d6c354207c51';
    perform public.atualizar_status_pedido_seguro(v_pedido,'cancelado');
    assert (select estoque=v_estoque from public.produtos where id='5e2eb8f4-39a7-4406-8fd4-d6c354207c51'),'Cancelamento histórico não cria estoque de base';
    select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_hash from public.produtos;
    perform public.atualizar_status_pedido_seguro(v_pedido,'cancelado');
    select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_depois from public.produtos;
    assert v_hash=v_depois,'Repetir cancelamento não repõe novamente';
    raise exception using errcode='Z0001',message='Reverter cenário';
  exception when sqlstate 'Z0001' then null;
  end;
  begin
    update public.produtos set estoque=6 where id='6ba865f2-1e6d-42c9-8185-8df23ed93af9';
    v_pedido:=public.criar_pedido_seguro('TESTE REVERTIDO','00000000000','TESTE','',jsonb_build_array(jsonb_build_object('produto_id','6ba865f2-1e6d-42c9-8185-8df23ed93af9','quantidade',4)),'[]',20,'TESTE TRANSACIONAL');
    perform public.atualizar_status_pedido_seguro(v_pedido,'em_preparo');
    assert not exists(select 1 from public.produtos where nome like 'Combo %' and estoque<>0),'Venda avulsa de copos atualiza todos os combos';
    perform public.atualizar_status_pedido_seguro(v_pedido,'cancelado');
    assert (select estoque>0 from public.produtos where id='de2675a7-665c-4de5-a0c9-ef96e3ee9c10'),'Reposição avulsa libera combo novamente';
    raise exception using errcode='Z0001',message='Reverter cenário';
  exception when sqlstate 'Z0001' then null;
  end;
end;
$edges$;
