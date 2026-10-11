type ProdutoVitrine = {
  id: string;
  destaque: boolean;
  mais_vendido?: boolean;
  posicao_mais_vendido?: number | null;
};

export function selecionarVitrineInicial<T extends ProdutoVitrine>(
  produtos: T[],
  estoqueDisponivel: (produto: T) => number
): T[] {
  const disponiveis = produtos.filter((produto) => estoqueDisponivel(produto) > 0);
  const principais = disponiveis
    .filter((produto) => produto.destaque || produto.mais_vendido)
    .sort((a, b) =>
      Number(b.destaque) - Number(a.destaque) ||
      (a.posicao_mais_vendido ?? Infinity) - (b.posicao_mais_vendido ?? Infinity)
    );
  const sugestoes = disponiveis
    .filter((produto) => !produto.destaque && !produto.mais_vendido)
    .slice(0, Math.max(0, 20 - principais.length));
  return [...principais, ...sugestoes];
}
