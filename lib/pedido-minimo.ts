export const PEDIDO_MINIMO_TABACARIA = 20;
export const PEDIDO_MINIMO_LONG_NECK = 6;

export const CIDADES_ENTREGA = [
  { nome: "Paranacity", pedidoMinimo: 25 },
  { nome: "Vila Rural", pedidoMinimo: 35 },
  { nome: "Cruzeiro do Sul", pedidoMinimo: 35 },
] as const;

export type CidadeEntrega = (typeof CIDADES_ENTREGA)[number]["nome"];

export const ehCidadeEntrega = (valor: unknown): valor is CidadeEntrega =>
  typeof valor === "string" &&
  CIDADES_ENTREGA.some((cidade) => cidade.nome === valor);

export type ItemPedidoMinimo = {
  categoria: string;
  tipoVenda: "caixa" | "avulso" | null;
  nome: string;
  descricao?: string | null;
  subtotal: number;
};

export type ItemPedidoMinimoLongNeck = ItemPedidoMinimo & {
  quantidade: number;
};

export type ResultadoPedidoMinimoLongNeck = {
  atingido: boolean;
  falta: number;
  faltaEmOutrosProdutos: number | null;
  liberadoPorOutrosProdutos: boolean;
  minimo: number;
  minimoOutrosProdutos: number | null;
  quantidade: number;
  temLongNeckAvulsa: boolean;
  valorOutrosProdutos: number;
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

const categoriaNormalizada = (item: Pick<ItemPedidoMinimo, "categoria">) =>
  normalizar(item.categoria);

const ehLataCervejaAvulsa = (item: ItemPedidoMinimo) =>
  categoriaNormalizada(item) === "cervejas" &&
  item.tipoVenda === "avulso" &&
  normalizar(`${item.nome} ${item.descricao ?? ""}`).includes("lata");

const ehCaixaCerveja = (item: ItemPedidoMinimo) =>
  categoriaNormalizada(item) === "cervejas" && item.tipoVenda === "caixa";

export const ehCervejaLongNeckAvulsa = (
  item: Pick<ItemPedidoMinimo, "categoria" | "tipoVenda" | "nome">
) =>
  categoriaNormalizada(item) === "cervejas" &&
  item.tipoVenda === "avulso" &&
  normalizar(item.nome).includes("long neck");

export const pedidoMinimoDaCidade = (cidade: CidadeEntrega) =>
  CIDADES_ENTREGA.find((item) => item.nome === cidade)?.pedidoMinimo ?? 35;

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

export function avaliarPedidoMinimoLongNeck(
  itens: ItemPedidoMinimoLongNeck[],
  cidade: CidadeEntrega | null
): ResultadoPedidoMinimoLongNeck {
  const longNecksAvulsas = itens.filter(ehCervejaLongNeckAvulsa);
  const quantidade = longNecksAvulsas.reduce(
    (total, item) =>
      total + Math.max(0, Math.floor(Number(item.quantidade) || 0)),
    0
  );
  const temLongNeckAvulsa = quantidade > 0;
  const avaliacaoOutrosProdutos = avaliarPedidoMinimo(
    itens.filter((item) => !ehCervejaLongNeckAvulsa(item)),
    cidade
  );
  const liberadoPorOutrosProdutos =
    temLongNeckAvulsa &&
    quantidade < PEDIDO_MINIMO_LONG_NECK &&
    avaliacaoOutrosProdutos.atingido;
  const falta = temLongNeckAvulsa && !liberadoPorOutrosProdutos
    ? Math.max(0, PEDIDO_MINIMO_LONG_NECK - quantidade)
    : 0;

  return {
    atingido: falta === 0,
    falta,
    faltaEmOutrosProdutos: avaliacaoOutrosProdutos.falta,
    liberadoPorOutrosProdutos,
    minimo: PEDIDO_MINIMO_LONG_NECK,
    minimoOutrosProdutos: avaliacaoOutrosProdutos.minimoReferencia,
    quantidade,
    temLongNeckAvulsa,
    valorOutrosProdutos: avaliacaoOutrosProdutos.valorConsiderado,
  };
}

export function mensagemPedidoMinimoLongNeck(
  resultado: ResultadoPedidoMinimoLongNeck
) {
  const complemento =
    resultado.falta === 1
      ? "Falta 1 unidade."
      : `Faltam ${resultado.falta} unidades.`;
  const alternativaOutrosProdutos =
    resultado.faltaEmOutrosProdutos === null
      ? ""
      : ` Ou complete mais R$ ${resultado.faltaEmOutrosProdutos
          .toFixed(2)
          .replace(".", ",")} em outros produtos; as long necks avulsas não entram nesse valor.`;

  return `O pedido mínimo para cervejas long neck avulsas é de ${resultado.minimo} unidades enquanto os outros produtos não atingirem o mínimo da entrega. ${complemento} Você pode misturar as marcas.${alternativaOutrosProdutos}`;
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
