type ProdutoPreco = {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string;
  tipo_venda: string | null;
  grupo_estoque: string | null;
  unidades_por_venda: number | null;
  disponivel?: boolean;
};

export function ehImperioUltra(produto: ProdutoPreco) {
  return produto.grupo_estoque === "cerveja-imperio-ultra-long-neck" &&
    [1, 6, 12].includes(produto.unidades_por_venda ?? 0);
}

type ContextoCarrinho = {
  itens: Array<{ id: string; quantidade: number }>;
  indice: number;
};

// O grupo de estoque identifica a mesma cerveja, variante e embalagem.
// Nunca agrupar apenas pela marca (ex.: tradicional e zero álcool).
export function dividirCervejaEmEmbalagens<T extends ProdutoPreco>(
  produto: T,
  quantidade: number,
  produtos: T[],
  categoria: string
): Array<{ produto: T; quantidade: number }> {
  const nome = produto.nome.toLowerCase();
  // A Ultra mantém as embalagens escolhidas: o desconto agrupa o carrinho.
  if (ehImperioUltra(produto)) return [{ produto, quantidade }];
  const tamanho = /long\s*neck/.test(nome) ? 6 : /\blata\b/.test(nome) ? 12 : 0;
  if (
    categoria.trim().toLowerCase() !== "cervejas" ||
    produto.tipo_venda !== "avulso" ||
    (produto.unidades_por_venda ?? 1) !== 1 ||
    !tamanho || quantidade < tamanho
  ) return [{ produto, quantidade }];

  const embalagem = produtos
    .filter((candidato) =>
      candidato.tipo_venda === "caixa" &&
      candidato.disponivel !== false &&
      candidato.categoria_id === produto.categoria_id &&
      (produto.grupo_estoque
        ? candidato.grupo_estoque === produto.grupo_estoque && candidato.unidades_por_venda === tamanho
        // Cadastro legado sem grupo: exigir o nome completo da cerveja,
        // removendo somente os sufixos de embalagem conhecidos.
        : !candidato.grupo_estoque &&
          tamanho === 6 &&
          /\s*-\s*pack\s+6\s*$/i.test(candidato.nome) &&
          candidato.nome.toLowerCase().replace(/\s*-\s*pack\s+6\s*$/i, "").trim() ===
            nome.replace(/\s*-\s*long\s*neck\s*$/i, "").trim())
    )
    .sort((a, b) => a.preco - b.preco || a.id.localeCompare(b.id))[0];
  if (!embalagem) return [{ produto, quantidade }];

  const partes = [{ produto: embalagem, quantidade: Math.floor(quantidade / tamanho) }];
  if (quantidade % tamanho) partes.push({ produto, quantidade: quantidade % tamanho });
  return partes;
}

export function subtotalCerveja<T extends ProdutoPreco>(
  produto: T, quantidade: number, produtos: T[], categoria: string,
  contexto?: ContextoCarrinho
) {
  if (categoria.trim().toLowerCase() === "cervejas" && ehImperioUltra(produto)) {
    const grupo = produtos.filter(p => p.categoria_id === produto.categoria_id && ehImperioUltra(p));
    const unidade = grupo.find(p => p.unidades_por_venda === 1);
    const caixa = grupo.find(p => p.unidades_por_venda === 12);
    if (unidade && caixa) {
      const linhas = contexto?.itens ?? [{ id: produto.id, quantidade }];
      const indice = contexto?.indice ?? 0;
      const unidades = linhas.map(linha => {
        const item = grupo.find(p => p.id === linha.id);
        return item ? linha.quantidade * (item.unidades_por_venda ?? 1) : 0;
      });
      const totalUnidades = unidades.reduce((soma, valor) => soma + valor, 0);
      if (totalUnidades > 0) {
        const totalCentavos = Math.floor(totalUnidades / 12) * Math.round(caixa.preco * 100) +
          (totalUnidades % 12) * Math.round(unidade.preco * 100);
        const anteriores = unidades.slice(0, indice).reduce((soma, valor) => soma + valor, 0);
        // Rateio em centavos garante que as linhas somem exatamente o total.
        return (Math.round(totalCentavos * (anteriores + unidades[indice]) / totalUnidades) -
          Math.round(totalCentavos * anteriores / totalUnidades)) / 100;
      }
    }
  }
  return dividirCervejaEmEmbalagens(produto, quantidade, produtos, categoria)
    .reduce((total, parte) => {
      const preco = Math.round(parte.produto.preco * 100);
      return total + preco * parte.quantidade;
    }, 0) / 100;
}
