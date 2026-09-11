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

// O grupo de estoque identifica a mesma cerveja, variante e embalagem.
// Nunca agrupar apenas pela marca (ex.: tradicional e zero álcool).
export function dividirCervejaEmEmbalagens<T extends ProdutoPreco>(
  produto: T,
  quantidade: number,
  produtos: T[],
  categoria: string
): Array<{ produto: T; quantidade: number }> {
  const nome = produto.nome.toLowerCase();
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
  produto: T, quantidade: number, produtos: T[], categoria: string
) {
  return dividirCervejaEmEmbalagens(produto, quantidade, produtos, categoria)
    .reduce((total, parte) => total + Math.round(parte.produto.preco * 100) * parte.quantidade, 0) / 100;
}
