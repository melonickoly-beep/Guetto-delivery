-- Mantém o estoque exibido dos combos limitado pelos componentes reais.
create or replace function public.recalcular_estoques_combos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_energeticos integer;
  v_gelos integer;
  v_askov integer;
begin
  select coalesce(sum(greatest(estoque, 0)), 0)::integer
    into v_energeticos
    from public.produtos
   where lower(nome) like 'furioso 2l - %'
     and disponivel = true;

  select floor(coalesce(max(greatest(estoque, 0)), 0) / 6.0)::integer
    into v_gelos
    from public.produtos
   where lower(trim(nome)) = 'gelo de sabor'
     and disponivel = true;

  select coalesce(sum(greatest(estoque, 0)), 0)::integer
    into v_askov
    from public.produtos
   where lower(nome) like 'askov 1l - %'
     and disponivel = true;

  update public.produtos
     set estoque = least(v_askov, v_energeticos, v_gelos)
   where lower(trim(nome)) = 'combo askov';

  update public.produtos combo
     set estoque = least(
       case
         when base.disponivel then greatest(base.estoque, 0)
         else 0
       end,
       case
         when base.estoque_opcoes is null then greatest(base.estoque, 0)
         else (
           select coalesce(sum(greatest(opcao.value::integer, 0)), 0)::integer
             from jsonb_each_text(base.estoque_opcoes) opcao
         )
       end,
       v_energeticos,
       v_gelos
     )
    from public.produtos base
   where combo.produto_base_id = base.id
     and lower(combo.nome) like 'combo %';
end;
$$;

revoke all on function public.recalcular_estoques_combos() from public;

create or replace function public.sincronizar_combo_apos_estoque_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if lower(old.nome) not like 'combo %' then
      perform public.recalcular_estoques_combos();
    end if;
    return old;
  end if;

  if lower(new.nome) not like 'combo %' then
    perform public.recalcular_estoques_combos();
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_combo_apos_estoque_produto()
  from public;

drop trigger if exists sincronizar_combo_apos_estoque_produto
  on public.produtos;

create trigger sincronizar_combo_apos_estoque_produto
after insert or delete or update
on public.produtos
for each row
execute function public.sincronizar_combo_apos_estoque_produto();

-- Os outros componentes já são baixados pela função de mudança de status.
-- Este gatilho inclui os seis gelos quando o pedido entra em preparo e os
-- devolve caso o pedido seja cancelado.
create or replace function public.movimentar_gelos_dos_combos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gelo public.produtos%rowtype;
  v_total integer := 0;
  v_sabor text;
  v_consumo_sabor integer;
  v_estoque_sabor integer;
begin
  if new.estoque_baixado = old.estoque_baixado then
    return new;
  end if;

  select coalesce(sum(
    greatest(coalesce((item->>'quantidade')::integer, 1), 1) *
    case
      when jsonb_typeof(item->'escolhas_combo'->'gelos') = 'array'
        then jsonb_array_length(item->'escolhas_combo'->'gelos')
      else 0
    end
  ), 0)::integer
    into v_total
    from jsonb_array_elements(new.itens) as itens(item);

  if v_total = 0 then
    return new;
  end if;

  select *
    into v_gelo
    from public.produtos
   where lower(trim(nome)) = 'gelo de sabor'
   limit 1
   for update;

  if not found then
    raise exception 'Produto Gelo de sabor não encontrado';
  end if;

  if new.estoque_baixado then
    if not v_gelo.disponivel or v_gelo.estoque < v_total then
      raise exception 'Estoque insuficiente para % gelos de sabor', v_total;
    end if;

    if v_gelo.estoque_opcoes is not null then
      for v_sabor, v_consumo_sabor in
        select sabor,
               sum(
                 greatest(coalesce((item->>'quantidade')::integer, 1), 1)
               )::integer
          from jsonb_array_elements(new.itens) as itens(item)
          cross join lateral jsonb_array_elements_text(
            case
              when jsonb_typeof(item->'escolhas_combo'->'gelos') = 'array'
                then item->'escolhas_combo'->'gelos'
              else '[]'::jsonb
            end
          ) as sabores(sabor)
         group by sabor
      loop
        v_estoque_sabor := coalesce(
          (v_gelo.estoque_opcoes->>v_sabor)::integer,
          0
        );
        if v_estoque_sabor < v_consumo_sabor then
          raise exception 'Estoque insuficiente para gelo de sabor %', v_sabor;
        end if;

        v_gelo.estoque_opcoes := jsonb_set(
          v_gelo.estoque_opcoes,
          array[v_sabor],
          to_jsonb(v_estoque_sabor - v_consumo_sabor),
          true
        );
      end loop;
    end if;

    update public.produtos
       set estoque = estoque - v_total,
           estoque_opcoes = v_gelo.estoque_opcoes
     where id = v_gelo.id;
  else
    if v_gelo.estoque_opcoes is not null then
      for v_sabor, v_consumo_sabor in
        select sabor,
               sum(
                 greatest(coalesce((item->>'quantidade')::integer, 1), 1)
               )::integer
          from jsonb_array_elements(new.itens) as itens(item)
          cross join lateral jsonb_array_elements_text(
            case
              when jsonb_typeof(item->'escolhas_combo'->'gelos') = 'array'
                then item->'escolhas_combo'->'gelos'
              else '[]'::jsonb
            end
          ) as sabores(sabor)
         group by sabor
      loop
        v_estoque_sabor := coalesce(
          (v_gelo.estoque_opcoes->>v_sabor)::integer,
          0
        );
        v_gelo.estoque_opcoes := jsonb_set(
          v_gelo.estoque_opcoes,
          array[v_sabor],
          to_jsonb(v_estoque_sabor + v_consumo_sabor),
          true
        );
      end loop;
    end if;

    update public.produtos
       set estoque = estoque + v_total,
           estoque_opcoes = v_gelo.estoque_opcoes
     where id = v_gelo.id;
  end if;

  return new;
end;
$$;

revoke all on function public.movimentar_gelos_dos_combos() from public;

drop trigger if exists movimentar_gelos_dos_combos
  on public.pedidos;

create trigger movimentar_gelos_dos_combos
after update of estoque_baixado
on public.pedidos
for each row
when (old.estoque_baixado is distinct from new.estoque_baixado)
execute function public.movimentar_gelos_dos_combos();

select public.recalcular_estoques_combos();
