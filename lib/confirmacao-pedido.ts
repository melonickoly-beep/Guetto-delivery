export type PedidoConfirmado = { id: string; mensagem: string; linkAcompanhamento: string; linkWhatsApp: string };
export function criarConfirmacao(id: string, mensagem: string, origem: string, telefone: string): PedidoConfirmado {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Pedido inválido");
  return { id, mensagem, linkAcompanhamento: origem + "/acompanhar/" + id,
    linkWhatsApp: "https://wa.me/" + telefone + "?text=" + encodeURIComponent(mensagem) };
}
export function recuperarConfirmacao(texto: string | null, origem: string, telefone: string, agora = Date.now()): PedidoConfirmado | null {
  try {
    const salvo = JSON.parse(texto ?? "null");
    if (!salvo || typeof salvo.mensagem !== "string" || salvo.mensagem.length > 50_000 ||
        !Number.isFinite(salvo.salvoEm) || salvo.salvoEm > agora || agora - salvo.salvoEm >= 86_400_000) return null;
    // Reconstrói links locais e do WhatsApp: não confia em URLs do armazenamento.
    return criarConfirmacao(salvo.id, salvo.mensagem, origem, telefone);
  } catch { return null; }
}
