-- Executar depois da migração. Não persiste pedidos nem mudanças de estoque.
begin;
do $test$
declare
  v_pedido uuid;
  v_avulso uuid;
  v_falhou boolean := false;
  v_combo uuid := 'de2675a7-665c-4de5-a0c9-ef96e3ee9c10';
  v_suco uuid := 'a8603cba-5779-4437-a1c8-8a1ce4747f6f';
  v_vodka uuid := 'ad5a9fc1-2e7a-4d81-80cd-256953c30142';
  v_gelo uuid := 'bc7c756d-2504-4b4c-a16e-ab735b878ced';
  v_copo uuid := '6ba865f2-1e6d-42c9-8185-8df23ed93af9';
begin
  update public.produtos set estoque = case id when v_copo then 12 else 4 end, disponivel = true
  where id in (v_suco, v_vodka, v_gelo, v_copo);
  assert (select estoque from public.produtos where id = v_combo) = 4, 'Disponibilidade inicial';

  v_avulso := public.criar_pedido_seguro('TESTE TRANSACIONAL', '00000000000', 'TESTE', '',
    jsonb_build_array(jsonb_build_object('produto_id', v_suco, 'quantidade', 1)), '[]', 20, 'ROLLBACK');
  perform public.atualizar_status_pedido_seguro(v_avulso, 'em_preparo');
  assert (select estoque from public.produtos where id = v_combo) = 3, 'Venda avulsa deve reduzir combo';
  perform public.atualizar_status_pedido_seguro(v_avulso, 'cancelado');
  assert (select estoque from public.produtos where id = v_combo) = 4, 'Cancelamento avulso deve repor';

  v_pedido := public.criar_pedido_seguro('TESTE TRANSACIONAL', '00000000000', 'TESTE', '',
    jsonb_build_array(jsonb_build_object('produto_id', v_combo, 'quantidade', 2,
      'escolhas_combo', jsonb_build_object('energetico', 'Tradicional', 'gelos', jsonb_build_array('Coco')))),
    '[]', 20, 'ROLLBACK');
  assert not (select (itens->0) ? 'escolhas_combo' from public.pedidos where id = v_pedido), 'Remover escolhas incompatíveis';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'em_preparo');
  assert (select estoque from public.produtos where id = v_suco) = 2, 'Baixa do suco';
  assert (select estoque from public.produtos where id = v_vodka) = 2, 'Baixa da vodka';
  assert (select estoque from public.produtos where id = v_gelo) = 2, 'Baixa do gelo';
  assert (select estoque from public.produtos where id = v_copo) = 6, 'Baixa de três copos por combo';
  assert (select estoque from public.produtos where id = v_combo) = 2, 'Saldo do combo';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'em_preparo');
  assert (select estoque from public.produtos where id = v_suco) = 2, 'Não duplicar baixa';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'cancelado');
  assert (select estoque from public.produtos where id = v_combo) = 4, 'Cancelamento repõe combo';
  assert (select estoque from public.produtos where id = v_copo) = 12, 'Cancelamento repõe copos';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'cancelado');
  assert (select estoque from public.produtos where id = v_copo) = 12, 'Não duplicar reposição';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'em_preparo');
  assert (select estoque from public.produtos where id = v_combo) = 2, 'Reabertura baixa novamente';
  perform public.atualizar_status_pedido_seguro(v_pedido, 'cancelado');

  update public.produtos set estoque = 2 where id = v_copo;
  assert (select estoque from public.produtos where id = v_combo) = 0, 'Menos de três copos impede combo';
  begin
    perform public.atualizar_status_pedido_seguro(v_pedido, 'em_preparo');
  exception when others then
    if sqlerrm not like 'Estoque insuficiente%' then raise; end if;
    v_falhou := true;
  end;
  assert v_falhou, 'Impedir venda sem estoque';
  assert (select estoque from public.produtos where id = v_suco) = 4, 'Rollback preserva suco';
  assert (select estoque from public.produtos where id = v_vodka) = 4, 'Rollback preserva vodka';
  assert (select status from public.pedidos where id = v_pedido) = 'cancelado', 'Rollback preserva status';

  update public.produtos set estoque = 12 where id = v_copo;
  update public.produtos set disponivel = false where id = v_suco;
  assert (select estoque from public.produtos where id = v_combo) = 0, 'Componente indisponível impede combo';
  update public.produtos set disponivel = true where id = v_suco;

  v_avulso := public.criar_pedido_seguro('TESTE TRANSACIONAL', '00000000000', 'TESTE', '',
    jsonb_build_array(jsonb_build_object('produto_id', v_combo, 'quantidade', 4),
      jsonb_build_object('produto_id', v_suco, 'quantidade', 1)), '[]', 20, 'ROLLBACK');
  v_falhou := false;
  begin
    perform public.atualizar_status_pedido_seguro(v_avulso, 'em_preparo');
  exception when others then
    if sqlerrm not like 'Estoque insuficiente%' then raise; end if;
    v_falhou := true;
  end;
  assert v_falhou, 'Somar consumo de avulso e combo no mesmo pedido';
  assert (select estoque from public.produtos where id = v_combo) = 4, 'Pedido misto falha atomicamente';
end;
$test$;
rollback;
select 'OK: avulso, combo, cancelamento, reabertura, falta de estoque e pedido misto. Testes revertidos.' as resultado;
