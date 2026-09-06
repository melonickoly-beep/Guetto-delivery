export const PEDIDO_MINIMO_TABACARIA = 20;
export const PEDIDO_MINIMO_LONG_NECK = 6;
export const QUANTIDADE_CAIXA_MISTA_LATAS = 12;

export const CIDADES_ENTREGA = [
  { nome: "Paranacity", pedidoMinimo: 25 },
  { nome: "Vila Rural", pedidoMinimo: 35 },
  { nome: "Cruzeiro do Sul", pedidoMinimo: 35 },
] as const;

export type CidadeEntrega = (typeof CIDADES_ENTREGA)[number]["nome"];

export const BAIRROS_POR_CIDADE = {
  Paranacity: [
    "Centro",
    "Vila Progresso",
    "Jd Matil",
    "Jd Bella Vista",
    "Jd Italia",
    "Conjunto Nonato",
    "Conjunto Jose Sanches",
    "Conjunto Joao Lopes",
    "Jardim Licce",
  ],
  "Vila Rural": ["Vila Rural", "Atrás do Panizza"],
  "Cruzeiro do Sul": ["Cruzeiro do Sul"],
} as const satisfies Record<CidadeEntrega, readonly string[]>;

export type BairroEntrega =
  (typeof BAIRROS_POR_CIDADE)[CidadeEntrega][number];

export const bairrosDaCidade = (cidade: CidadeEntrega | "") =>
  cidade ? BAIRROS_POR_CIDADE[cidade] : [];

export const ehBairroEntrega = (
  cidade: CidadeEntrega,
  bairro: unknown
): bairro is BairroEntrega =>
  typeof bairro === "string" &&
  (BAIRROS_POR_CIDADE[cidade] as readonly string[]).includes(bairro);

export const ehCidadeEntrega = (valor: unknown): valor is CidadeEntrega =>
  typeof valor === "string" &&
  CIDADES_ENTREGA.some((cidade) => cidade.nome === valor);

export type ItemPedidoMinimo = {
  categoria: string;
  tipoVenda: "caixa" | "avulso" | null;
  nome: string;
  descricao?: string | null;
  subtotal: number;
  quantidade: number;
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
  | "caixa_mista"
  | "pack_misto_long_neck"
  | "pacote_erva_terere"
  | "duas_cocas_2l"
  | null;

export type ResultadoPedidoMinimo = {
  atingido: boolean;
  falta: number | null;
  liberadoPor: LiberacaoPedidoMinimo;
  minimoReferencia: number | null;
  faltaLatasParaCaixaMista: number;
  quantidadeLatasAvulsas: number;
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

const ehPacoteErvaTerere = (item: ItemPedidoMinimo) => {
  const texto = normalizar(`${item.nome} ${item.descricao ?? ""}`);
  return texto.includes("erva") && texto.includes("terere");
};

const ehCocaCola2Litros = (item: ItemPedidoMinimo) => {
  const texto = normalizar(`${item.nome} ${item.descricao ?? ""}`);
  return (
    (texto.includes("coca-cola") || texto.includes("coca cola")) &&
    /\b2\s*l\b/.test(texto)
  );
};

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
  const quantidadeLatasAvulsas = latasCervejaAvulsas.reduce(
    (total, item) =>
      total + Math.max(0, Math.floor(Number(item.quantidade) || 0)),
    0
  );
  const faltaLatasParaCaixaMista = Math.max(
    0,
    QUANTIDADE_CAIXA_MISTA_LATAS - quantidadeLatasAvulsas
  );
  const quantidadeLongNecksAvulsas = itens
    .filter(ehCervejaLongNeckAvulsa)
    .reduce(
      (total, item) =>
        total + Math.max(0, Math.floor(Number(item.quantidade) || 0)),
      0
    );

  if (!cidade) {
    return {
      atingido: false,
      falta: null,
      liberadoPor: null,
      minimoReferencia: null,
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
      temLataCervejaAvulsa,
      valorConsiderado: 0,
      valorTotal,
    };
  }

  const minimoCidade = pedidoMinimoDaCidade(cidade);

  if (cidade === "Paranacity") {
    const quantidadePacotesErvaTerere = itens
      .filter(ehPacoteErvaTerere)
      .reduce(
        (total, item) =>
          total + Math.max(0, Math.floor(Number(item.quantidade) || 0)),
        0
      );

    if (quantidadePacotesErvaTerere >= 1) {
      return {
        atingido: true,
        falta: 0,
        liberadoPor: "pacote_erva_terere",
        minimoReferencia: minimoCidade,
        faltaLatasParaCaixaMista,
        quantidadeLatasAvulsas,
        temLataCervejaAvulsa,
        valorConsiderado: minimoCidade,
        valorTotal,
      };
    }

    const quantidadeCocas2Litros = itens
      .filter(ehCocaCola2Litros)
      .reduce(
        (total, item) =>
          total + Math.max(0, Math.floor(Number(item.quantidade) || 0)),
        0
      );

    if (quantidadeCocas2Litros >= 2) {
      return {
        atingido: true,
        falta: 0,
        liberadoPor: "duas_cocas_2l",
        minimoReferencia: minimoCidade,
        faltaLatasParaCaixaMista,
        quantidadeLatasAvulsas,
        temLataCervejaAvulsa,
        valorConsiderado: minimoCidade,
        valorTotal,
      };
    }
  }

  if (quantidadeLongNecksAvulsas >= PEDIDO_MINIMO_LONG_NECK) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "pack_misto_long_neck",
      minimoReferencia: minimoCidade,
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
      temLataCervejaAvulsa,
      valorConsiderado: minimoCidade,
      valorTotal,
    };
  }

  if (!temLataCervejaAvulsa) {
    const minimoReferencia = cidade === "Paranacity" && somenteTabacaria
      ? PEDIDO_MINIMO_TABACARIA
      : minimoCidade;
    const falta = Math.max(0, minimoReferencia - valorTotal);

    return {
      atingido: falta === 0,
      falta,
      liberadoPor:
        falta === 0
          ? cidade === "Paranacity" && somenteTabacaria
            ? "tabacaria"
            : "cidade"
          : null,
      minimoReferencia,
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
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
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
      temLataCervejaAvulsa,
      valorConsiderado: minimoCidade,
      valorTotal,
    };
  }

  if (quantidadeLatasAvulsas >= QUANTIDADE_CAIXA_MISTA_LATAS) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "caixa_mista",
      minimoReferencia: minimoCidade,
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
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
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
      temLataCervejaAvulsa,
      valorConsiderado: valorSemLatasAvulsas,
      valorTotal,
    };
  }

  if (cidade === "Paranacity" && faltaTabacaria === 0) {
    return {
      atingido: true,
      falta: 0,
      liberadoPor: "tabacaria",
      minimoReferencia: PEDIDO_MINIMO_TABACARIA,
      faltaLatasParaCaixaMista,
      quantidadeLatasAvulsas,
      temLataCervejaAvulsa,
      valorConsiderado: valorTabacaria,
      valorTotal,
    };
  }

  const caminhoTabacariaMaisProximo =
    cidade === "Paranacity" && faltaTabacaria < faltaCidade;

  return {
    atingido: false,
    falta: caminhoTabacariaMaisProximo ? faltaTabacaria : faltaCidade,
    liberadoPor: null,
    minimoReferencia: caminhoTabacariaMaisProximo
      ? PEDIDO_MINIMO_TABACARIA
      : minimoCidade,
    faltaLatasParaCaixaMista,
    quantidadeLatasAvulsas,
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

  return `O pedido mínimo para cervejas long neck avulsas é de ${resultado.minimo} unidades enquanto os outros produtos não atingirem o mínimo da entrega. ${complemento} Você pode misturar as marcas para completar o pack; o total usa o preço avulso de cada unidade.${alternativaOutrosProdutos}`;
}

export function mensagemPedidoMinimo(
  resultado: ResultadoPedidoMinimo,
  cidade: CidadeEntrega
) {
  const excecoesParanacity = cidade === "Paranacity"
    ? " Em Paranacity, 1 pacote de erva de tereré ou 2 Coca Cola 2L também liberam a entrega."
    : "";

  if (resultado.temLataCervejaAvulsa) {
    const alternativaCaixaMista = resultado.faltaLatasParaCaixaMista === 1
      ? " ou adicione mais 1 lata para completar uma caixa mista de 12"
      : ` ou adicione mais ${resultado.faltaLatasParaCaixaMista} latas para completar uma caixa mista de 12`;

    return `Latas avulsas de cerveja só são liberadas após R$ ${pedidoMinimoDaCidade(cidade)
      .toFixed(2)
      .replace(".", ",")} em outros itens, R$ ${PEDIDO_MINIMO_TABACARIA.toFixed(2).replace(".", ",")} em tabacaria, com uma caixa/pack fechado de cerveja${alternativaCaixaMista}. Você pode misturar as marcas e o preço continua sendo o das unidades avulsas.${excecoesParanacity}`;
  }

  return `O pedido mínimo para entrega em ${cidade} é de R$ ${(
    resultado.minimoReferencia ?? pedidoMinimoDaCidade(cidade)
  )
    .toFixed(2)
    .replace(".", ",")}.${excecoesParanacity}`;
}
