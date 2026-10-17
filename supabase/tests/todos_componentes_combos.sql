create temp table auditoria_combos_20261016 (combo text, bebida_avulsa text, baixa_bebida integer, baixa_energetico integer, baixa_gelo integer, baixa_copos_com_canudo integer, baixa_sabor_gelo integer, reposicao_ok boolean, erro text) on commit drop;
do $audit$
declare
v_combo record; v_askov text; v_base_id uuid; v_base_nome text; v_gelo_id uuid; v_pedido uuid; v_antes_bebida integer; v_antes_energetico integer; v_antes_gelo integer; v_antes_copo integer; v_antes_sabor integer; v_baixa_bebida integer; v_baixa_energetico integer; v_baixa_gelo integer; v_baixa_copo integer; v_baixa_sabor integer; v_reposicao boolean; v_erro text; v_antes jsonb; v_depois jsonb; v_hash_antes text; v_hash_depois text;
begin
select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_hash_antes from public.produtos;
for v_combo in select * from public.produtos where categoria_id='a441e43b-3c63-4d16-b1d8-71ef6ff3409d' order by nome loop
v_baixa_bebida:=null;v_baixa_energetico:=null;v_baixa_gelo:=null;v_baixa_copo:=null;v_baixa_sabor:=null;v_reposicao:=false;v_erro:=null;v_base_nome:=null;
begin
select replace(nome,'Askov 1L - ','') into v_askov from public.produtos where nome like 'Askov 1L - %' and disponivel and estoque>0 order by nome limit 1;
v_base_id:=case when v_combo.nome='Combo Smirnoff' then 'ad5a9fc1-2e7a-4d81-80cd-256953c30142'::uuid when v_combo.nome='Combo Askov' then (select id from public.produtos where nome='Askov 1L - '||v_askov) when v_combo.nome='Combo Busca Brisa' then '5e2eb8f4-39a7-4406-8fd4-d6c354207c51'::uuid else v_combo.produto_base_id end;
v_gelo_id:=case when v_combo.nome='Combo Smirnoff' then 'bc7c756d-2504-4b4c-a16e-ab735b878ced'::uuid else '27ba1256-daa8-42b6-a093-3728cb6a2a23'::uuid end;
select nome,estoque into v_base_nome,v_antes_bebida from public.produtos where id=v_base_id;
select estoque into v_antes_energetico from public.produtos where id='b9b4183b-9538-4b04-8916-61da8851deb6';
select estoque,coalesce((estoque_opcoes->>'Coco')::integer,0) into v_antes_gelo,v_antes_sabor from public.produtos where id=v_gelo_id;
select estoque into v_antes_copo from public.produtos where id='6ba865f2-1e6d-42c9-8185-8df23ed93af9';
select jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id) into v_antes from public.produtos where nome not like 'Combo %';
v_pedido:=public.criar_pedido_seguro('AUDITORIA REVERTIDA','00000000000','TESTE TRANSACIONAL','',jsonb_build_array(jsonb_build_object('produto_id',v_combo.id,'quantidade',1,'escolhas_combo',jsonb_build_object('askov',v_askov,'whisky','Tradicional','energetico','Tradicional','gelos',jsonb_build_array('Coco','Coco','Coco','Coco','Coco','Coco')))),'[]',20,'AUDITORIA SEM PERSISTENCIA');
perform public.atualizar_status_pedido_seguro(v_pedido,'em_preparo');
select v_antes_bebida-estoque into v_baixa_bebida from public.produtos where id=v_base_id;
select v_antes_energetico-estoque into v_baixa_energetico from public.produtos where id='b9b4183b-9538-4b04-8916-61da8851deb6';
select v_antes_gelo-estoque,v_antes_sabor-coalesce((estoque_opcoes->>'Coco')::integer,0) into v_baixa_gelo,v_baixa_sabor from public.produtos where id=v_gelo_id;
select v_antes_copo-estoque into v_baixa_copo from public.produtos where id='6ba865f2-1e6d-42c9-8185-8df23ed93af9';
perform public.atualizar_status_pedido_seguro(v_pedido,'cancelado');
select jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id) into v_depois from public.produtos where nome not like 'Combo %';
v_reposicao:=(v_antes=v_depois);
raise exception using errcode='Z0001',message='Reverter simulacao';
exception when sqlstate 'Z0001' then null; when others then v_erro:=sqlerrm;
end;
insert into auditoria_combos_20261016 values(v_combo.nome,v_base_nome,v_baixa_bebida,v_baixa_energetico,v_baixa_gelo,v_baixa_copo,v_baixa_sabor,v_reposicao,v_erro);
end loop;
select md5(jsonb_agg(jsonb_build_array(id,estoque,estoque_opcoes) order by id)::text) into v_hash_depois from public.produtos;
assert v_hash_antes=v_hash_depois,'Auditoria deve preservar todos os estoques originais';
end;
$audit$;
select * from auditoria_combos_20261016 order by combo;
do $checks$
begin
  assert (select count(*) from auditoria_combos_20261016)=9, 'Testar os nove combos';
  assert not exists(select 1 from auditoria_combos_20261016 where erro is not null or baixa_bebida<>1 or baixa_copos_com_canudo<>3 or baixa_energetico<>case when combo='Combo Smirnoff' then 0 else 1 end or baixa_gelo<>case when combo='Combo Smirnoff' then 1 else 6 end or baixa_sabor_gelo<>case when combo='Combo Smirnoff' then 0 else 6 end or not reposicao_ok), 'Todos os componentes devem ser baixados e repostos';
end;
$checks$;
