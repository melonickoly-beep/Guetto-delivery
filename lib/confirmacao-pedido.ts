export type PedidoConfirmado = { id: string; mensagem: string; linkAcompanhamento: string; linkWhatsApp: string };
type ItemConfirmado = { nome: string; quantidade: number; subtotal?: number; preco_unitario: number; escolhas_combo?: Record<string, unknown> | null };
export function mensagemRecuperada(dados: { id: string; total: number; itens: ItemConfirmado[] }, origem: string): string {
  if (!Array.isArray(dados.itens) || !dados.itens.length || !Number.isFinite(Number(dados.total))) throw new Error("Confirmação incompleta");
  const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  const linhas = dados.itens.map(item => `${item.quantidade}x ${item.nome} — ${moeda(Number(item.subtotal ?? item.preco_unitario * item.quantidade))}${item.escolhas_combo ? "\n   Escolhas: " + Object.entries(item.escolhas_combo).map(([nome, valor]) => nome + ": " + (Array.isArray(valor) ? valor.join(", ") : String(valor))).join(" | ") : ""}`);
  return `Olá! Segue meu pedido já registrado:\n\n${linhas.join("\n")}\n\nTotal: ${moeda(Number(dados.total))}\nPedido registrado nº ${dados.id}\nAcompanhe: ${origem}/acompanhar/${dados.id}`;
}
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
