-- Todo pedido passa pela API do site, que valida se o atendimento do dia é
-- delivery ou somente retirada. O cliente não pode contornar essa regra
-- chamando a função do banco diretamente com a chave pública.

revoke execute on function public.criar_pedido_seguro(
  text, text, text, text, jsonb, jsonb, integer, text
) from public, anon, authenticated;

grant execute on function public.criar_pedido_seguro(
  text, text, text, text, jsonb, jsonb, integer, text
) to service_role;
