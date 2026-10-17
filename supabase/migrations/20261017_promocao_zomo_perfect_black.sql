-- Inclui Perfect Black no cálculo atual sem substituir as outras promoções.
do $$
declare
  v_definicao text;
begin
  v_definicao := pg_get_functiondef('public.calcular_total_promocional_pedido()'::regprocedure);
  if position('seda zomo perfect black' in v_definicao) = 0 then
    if position('''seda zomo slim branca''' in v_definicao) = 0 then
      raise exception 'Lista da promoção Zomo não identificada';
    end if;
    v_definicao := replace(v_definicao, '''seda zomo slim branca''', '''seda zomo slim branca'', ''seda zomo perfect black''');
    execute v_definicao;
  end if;
end;
$$;
