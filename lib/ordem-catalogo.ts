type ProdutoOrdenavel = { id: string; nome: string; categoria_id: string; tipo_venda?: string | null; unidades_por_venda?: number | null };
type Secao<T> = { id: string; titulo: string; descricao: string; produtos: T[] };
const compararNome = (a: ProdutoOrdenavel, b: ProdutoOrdenavel) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base", numeric: true }) || a.id.localeCompare(b.id);

export function ordenarCatalogo<T extends ProdutoOrdenavel>(produtos: T[], estoque: (p: T) => number, cervejasId?: string): T[] {
  const prioridade = (p: T) => {
    if (estoque(p) <= 0) return 3;
    if (cervejasId && p.categoria_id === cervejasId) {
      return p.tipo_venda === "caixa" || (p.unidades_por_venda ?? 1) > 1 ? 0 : 1;
    }
    return 2;
  };
  return [...produtos].sort((a, b) => prioridade(a) - prioridade(b) || compararNome(a, b));
}

// Nenhum esgotado de uma subseção pode preceder os disponíveis da seguinte.
export function esgotadosNoFinal<T extends ProdutoOrdenavel>(secoes: Secao<T>[], estoque: (p: T) => number): Secao<T>[] {
  if (secoes.length <= 1) return secoes;
  const disponiveis = secoes.map(s => ({ ...s, produtos: s.produtos.filter(p => estoque(p) > 0) })).filter(s => s.produtos.length);
  const esgotados = secoes.flatMap(s => s.produtos.filter(p => estoque(p) <= 0)).sort(compararNome);
  return esgotados.length ? [...disponiveis, { id: "esgotados", titulo: "Sem estoque", descricao: "Produtos temporariamente esgotados.", produtos: esgotados }] : disponiveis;
}
