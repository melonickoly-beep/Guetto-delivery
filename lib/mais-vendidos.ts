type PedidoComItens = {
  pedido_id: string;
  itens: { produto_id?: string; quantidade: number }[];
};

// Uma compra isolada, mesmo com muitas unidades, não indica recorrência.
const MINIMO_PEDIDOS = 3;

export function classificarMaisVendidos(
  pedidos: PedidoComItens[]
): string[] {
  const ranking = new Map<string, { quantidade: number; pedidos: Set<string> }>();
  const pedidosProcessados = new Set<string>();
  for (const pedido of pedidos) {
    if (pedidosProcessados.has(pedido.pedido_id)) continue;
    pedidosProcessados.add(pedido.pedido_id);
    for (const item of pedido.itens) {
      const quantidade = Number(item.quantidade);
      if (!item.produto_id || !Number.isFinite(quantidade) || quantidade <= 0) continue;
      const total = ranking.get(item.produto_id) ?? { quantidade: 0, pedidos: new Set<string>() };
      total.quantidade += quantidade;
      total.pedidos.add(pedido.pedido_id);
      ranking.set(item.produto_id, total);
    }
  }
  return [...ranking.entries()]
    .filter(([, total]) => total.pedidos.size >= MINIMO_PEDIDOS)
    .sort(([idA, a], [idB, b]) =>
      b.quantidade - a.quantidade || b.pedidos.size - a.pedidos.size || idA.localeCompare(idB)
    )
    .map(([id]) => id);
}
