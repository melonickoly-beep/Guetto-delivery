export const PEDIDO_MINIMO_TABACARIA = 20;

export type CidadeEntrega = "Paranacity" | "Cruzeiro do Sul";

export type ItemPedidoMinimo = {
  categoria: string;
  tipoVenda: "caixa" | "avulso" | null;
  nome: string;
  descricao?: string | null;
  subtotal: number;
};

export type LiberacaoPedidoMinimo =
  | "cidade"
  | "tabacaria"
  | "caixa_cerveja"
  | null;

export type ResultadoPedidoMinimo = {
  atingido: boolean;
  falta: number | null;
  liberadoPor: LiberacaoPedidoMinimo;
  minimoReferencia: number | null;
  temLataCervejaAvulsa: boolean;
  valorConsiderado: number;
  valorTotal: number;
};

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const categoriaNormalizada = (item: ItemPedidoMinimo) =>
  normalizar(item.categoria);

const ehLataCervejaAvulsa = (item: ItemPedidoMinimo) =>
  categoriaNormalizada(item) === "cervejas" &&
  item.tipoVenda === "avulso" &&
  normalizar(`${item.nome} ${item.descricao ?? ""}`).includes("lata");

const ehCaixaCerveja = (item: ItemPedidoMinimo) =>
  categoriaNormalizada(item) === "cervejas" && item.tipoVenda === "caixa";

export const pedidoMinimoDaCidade = (cidade: CidadeEntrega) =>
  cidade === "Paranacity" ? 25 : 35;

export function avaliarPedidoMinimo(
  itens: ItemPedidoMinimo[],
  cidade: CidadeEntrega | null
): ResultadoPedidoMinimo {
  const valorTotal = itens.reduce((total, item) => total + item.subtotal, 0);
  const itensTabacaria = itens.filter(
    (item) => categoriaNormalizada(item) === "tabacaria"
  );
  const valorTabacaria = itensTabacaria.reduce(
    (total, item) => total + item.subtotal,
    0
  );
  const somenteTabacaria =
    itens.length > 0 && itensTabacaria.length === itens.length;
  const latasCervejaAvulsas = itens.filter(ehLataCervejaAvulsa);
  const temLataCervejaAvulsa = latasCervejaAvulsas.length > 0;

  if (!cidade) {
    return {
      atingido: false,
      falta: null,
      liberadoPor: null,
      minimoReferencia: null,
      temLataCervejaAvulsa,
      valorConsiderado: 0,
      valorTotal,
    };
  }

  const minimoCidade = pedidoMinimoDaCidade(cidade);

  if (!temLataCervejaAvulsa) {
    const minimoReferencia = somenteTabacaria
      ? PEDIDO_MINIMO_TABACARIA
      : minimoCidade;
    const falta = Math.max(0, minimoReferencia - valorTotal);

    return {
      atingido: falta === 0,
      falta,
      liberadoPor:
        falta === 0 ? (somenteTabacaria ? "tabacaria" : "cidade") : null,
      minimoReferencia,
      temLataCervejaAvulsa,
      valorConsiderado: valorTotal,
      valorTotal,
    };
  }

  if (itens.some(ehCaixaCerveja)) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "caixa_cerveja",
      minimoReferencia: minimoCidade,
      temLataCervejaAvulsa,
      valorConsiderado: minimoCidade,
      valorTotal,
    };
  }

  const valorLatasAvulsas = latasCervejaAvulsas.reduce(
    (total, item) => total + item.subtotal,
    0
  );
  const valorSemLatasAvulsas = valorTotal - valorLatasAvulsas;
  const faltaCidade = Math.max(0, minimoCidade - valorSemLatasAvulsas);
  const faltaTabacaria = Math.max(
    0,
    PEDIDO_MINIMO_TABACARIA - valorTabacaria
  );

  if (faltaCidade === 0) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "cidade",
      minimoReferencia: minimoCidade,
      temLataCervejaAvulsa,
      valorConsiderado: valorSemLatasAvulsas,
      valorTotal,
    };
  }

  if (faltaTabacaria === 0) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "tabacaria",
      minimoReferencia: PEDIDO_MINIMO_TABACARIA,
      temLataCervejaAvulsa,
      valorConsiderado: valorTabacaria,
      valorTotal,
    };
  }

  const caminhoTabacariaMaisProximo = faltaTabacaria < faltaCidade;

  return {
    atingido: false,
    falta: caminhoTabacariaMaisProximo ? faltaTabacaria : faltaCidade,
    liberadoPor: null,
    minimoReferencia: caminhoTabacariaMaisProximo
      ? PEDIDO_MINIMO_TABACARIA
      : minimoCidade,
    temLataCervejaAvulsa,
    valorConsiderado: caminhoTabacariaMaisProximo
      ? valorTabacaria
      : valorSemLatasAvulsas,
    valorTotal,
  };
}

export function mensagemPedidoMinimo(
  resultado: ResultadoPedidoMinimo,
  cidade: CidadeEntrega
) {
  if (resultado.temLataCervejaAvulsa) {
    return `Latas avulsas de cerveja só são liberadas após R$ ${pedidoMinimoDaCidade(cidade)
      .toFixed(2)
      .replace(".", ",")} em outros itens, R$ ${PEDIDO_MINIMO_TABACARIA.toFixed(2).replace(".", ",")} em tabacaria ou com uma caixa/pack fechado de cerveja. As latas avulsas não entram no pedido mínimo.`;
  }

  return `O pedido mínimo para entrega em ${cidade} é de R$ ${(
    resultado.minimoReferencia ?? pedidoMinimoDaCidade(cidade)
  )
    .toFixed(2)
    .replace(".", ",")}.`;
}
