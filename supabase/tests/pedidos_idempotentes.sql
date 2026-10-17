-- Todos os registros de teste são revertidos pela subtransação.
do $test$
declare
  v_chave uuid:=gen_random_uuid();
  v_id uuid;
  v_repetido uuid;
  v_falhou boolean:=false;
  v_produto uuid;
  v_itens jsonb;
  v_antes text;
  v_depois text;
begin
  select id into v_produto from public.produtos where disponivel and estoque>0 and nome not like 'Combo %' order by nome limit 1;
  v_itens:=jsonb_build_array(jsonb_build_object('produto_id',v_produto,'quantidade',1));
  select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_antes from public.produtos;
  begin
    v_id:=public.criar_pedido_idempotente(v_chave,repeat('a',64),'TESTE REVERTIDO','00000000000','TESTE','',v_itens,'[]',20,'TESTE SEM PERSISTÊNCIA');
    v_repetido:=public.criar_pedido_idempotente(v_chave,repeat('a',64),'TESTE REVERTIDO','00000000000','TESTE','',v_itens,'[]',20,'TESTE SEM PERSISTÊNCIA');
    assert v_id=v_repetido,'Reenvio deve retornar o mesmo pedido';
    assert (select count(*)=1 from public.pedidos where id=v_id),'Somente um pedido criado';
    assert (select count(*)=1 from public.pedidos_idempotencia where chave=v_chave),'Somente uma tentativa registrada';
    begin
      perform public.criar_pedido_idempotente(v_chave,repeat('b',64),'TESTE REVERTIDO','00000000000','TESTE','',v_itens,'[]',20,'TESTE SEM PERSISTÊNCIA');
    exception when invalid_parameter_value then v_falhou:=true;
    end;
    assert v_falhou,'A mesma chave não pode registrar outro conteúdo';
    raise exception using errcode='Z0001',message='Reverter teste';
  exception when sqlstate 'Z0001' then null;
  end;
  assert not exists(select 1 from public.pedidos_idempotencia where chave=v_chave),'Não deixar tentativas de teste';
  select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_depois from public.produtos;
  assert v_antes=v_depois,'Teste deve preservar o estoque';
end;
$test$;
