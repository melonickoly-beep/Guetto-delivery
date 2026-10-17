type ProdutoVitrine = {
  id: string;
  destaque: boolean;
  mais_vendido?: boolean;
  posicao_mais_vendido?: number | null;
  nome?: string;
  categoria_id?: string;
  tipo_venda?: string | null;
  unidades_por_venda?: number | null;
};

export function selecionarVitrineInicial<T extends ProdutoVitrine>(
  produtos: T[],
  estoqueDisponivel: (produto: T) => number,
  categoriaCervejasId?: string
): T[] {
  const disponiveis = produtos.filter((produto) => estoqueDisponivel(produto) > 0);
  return disponiveis
    .filter((produto) => {
      const nome = produto.nome ?? "";
      const cerveja = (Boolean(categoriaCervejasId) && produto.categoria_id === categoriaCervejasId) || /^cerveja\b/i.test(nome);
      const embalagemFechada = produto.tipo_venda === "caixa" ||
        (produto.unidades_por_venda ?? 1) > 1 || /\b(?:cx|caixa|pack)\b/i.test(nome);
      if (!cerveja || embalagemFechada) return true;
      return /\bgarrafa\s*(?:de\s*)?300\s*ml\b/i.test(nome) &&
        typeof produto.posicao_mais_vendido === "number" &&
        Number.isFinite(produto.posicao_mais_vendido) && produto.posicao_mais_vendido > 0;
    })
    .filter((produto) => produto.destaque || produto.mais_vendido)
    .sort((a, b) =>
      Number(b.destaque) - Number(a.destaque) ||
      (a.posicao_mais_vendido ?? Infinity) - (b.posicao_mais_vendido ?? Infinity)
    )
    .slice(0, 24);
}
