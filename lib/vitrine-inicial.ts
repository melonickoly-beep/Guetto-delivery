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
  return disponiveis
    .filter((produto) => produto.destaque || produto.mais_vendido)
    .sort((a, b) =>
      Number(b.destaque) - Number(a.destaque) ||
      (a.posicao_mais_vendido ?? Infinity) - (b.posicao_mais_vendido ?? Infinity)
    )
    .slice(0, 24);
}
