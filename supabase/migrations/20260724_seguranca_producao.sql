-- Guetto Delivery: segurança e criação transacional de pedidos.
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.configuracoes enable row level security;
alter table public.pedidos enable row level security;

drop policy if exists "catalogo publico categorias" on public.categorias;
create policy "catalogo publico categorias"
on public.categorias for select
to anon, authenticated
using (true);

drop policy if exists "catalogo publico produtos" on public.produtos;
create policy "catalogo publico produtos"
on public.produtos for select
to anon, authenticated
using (true);

drop policy if exists "configuracoes publicas" on public.configuracoes;
create policy "configuracoes publicas"
on public.configuracoes for select
to anon, authenticated
using (true);

drop policy if exists "administrador gerencia categorias" on public.categorias;
create policy "administrador gerencia categorias"
on public.categorias for all
to authenticated
using (true)
with check (true);

drop policy if exists "administrador gerencia produtos" on public.produtos;
create policy "administrador gerencia produtos"
on public.produtos for all
to authenticated
using (true)
with check (true);

drop policy if exists "administrador gerencia configuracoes" on public.configuracoes;
create policy "administrador gerencia configuracoes"
on public.configuracoes for all
to authenticated
using (true)
with check (true);

drop policy if exists "administrador consulta pedidos" on public.pedidos;
create policy "administrador consulta pedidos"
on public.pedidos for select
to authenticated
using (true);

drop policy if exists "administrador atualiza pedidos" on public.pedidos;
create policy "administrador atualiza pedidos"
on public.pedidos for update
to authenticated
using (true)
with check (true);

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
  v_consumo integer;
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
       and disponivel = true
     for update;

    if not found then
      raise exception 'Produto indisponível';
    end if;

    if v_produto.grupo_estoque is not null
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

      update public.produtos
         set estoque = estoque - v_quantidade
       where id = v_produto.id;
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
    cliente_nome,
    telefone,
    endereco,
    referencia,
    itens,
    total,
    pagamento,
    tempo_entrega,
    observacao,
    status
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

drop policy if exists "imagens publicas de produtos" on storage.objects;
create policy "imagens publicas de produtos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'produtos');

drop policy if exists "administrador envia imagens de produtos" on storage.objects;
create policy "administrador envia imagens de produtos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'produtos');

drop policy if exists "administrador atualiza imagens de produtos" on storage.objects;
create policy "administrador atualiza imagens de produtos"
on storage.objects for update
to authenticated
using (bucket_id = 'produtos')
with check (bucket_id = 'produtos');

drop policy if exists "administrador exclui imagens de produtos" on storage.objects;
create policy "administrador exclui imagens de produtos"
on storage.objects for delete
to authenticated
using (bucket_id = 'produtos');
