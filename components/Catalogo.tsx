"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  RotateCcw,
  X,
  Clock3,
  MapPin,
  MessageCircle,
  Store,
  Truck,
  History,
  Check,
  CheckCircle2,
  CreditCard,
  Banknote,
  QrCode,
  MoreHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  avaliarPedidoMinimo,
  avaliarPedidoMinimoLongNeck,
  bairrosDaCidade,
  CIDADES_ENTREGA,
  ehBairroEntrega,
  mensagemPedidoMinimo,
  mensagemPedidoMinimoLongNeck,
  type CidadeEntrega,
} from "@/lib/pedido-minimo";

type Categoria = {
  id: string;
  nome: string;
  icone: string;
};

type Produto = {
  id: string;
  categoria_id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  imagem: string | null;
  destaque: boolean;
  tipo_venda: "caixa" | "avulso" | null;
  grupo_estoque: string | null;
  unidades_por_venda: number | null;
  estoque_unidades: number | null;
  mais_vendido?: boolean;
  posicao_mais_vendido?: number | null;
  estoque_opcoes?: Record<string, number> | null;
  detalhes_opcoes?: Record<
    string,
    { descricao?: string; imagem?: string }
  > | null;
};

type EscolhasCombo = {
  askov?: string;
  energetico: string;
  gelos: string[];
  whisky?: string;
};

type ItemCarrinho = Produto & {
  quantidade: number;
  escolhasCombo?: EscolhasCombo;
  sabor?: string;
};

type FormaPagamento = "pix" | "dinheiro" | "credito" | "debito";
type QuantidadePagamentos = 1 | 2 | 3;
type EtapaCheckout = 1 | 2;

type Pagamento = {
  forma: FormaPagamento | "";
  valor: string;
  precisaTroco: boolean | null;
  trocoPara: string;
};

type DadosClienteSalvos = {
  nomeCompleto?: string;
  nome?: string;
  sobrenome?: string;
  telefone: string;
  endereco?: string;
  rua?: string;
  numeroEndereco?: string;
  bairro: string;
  referencia: string;
  cidadeEntrega: "" | CidadeEntrega;
};

type ErrosCheckout = Partial<
  Record<"nomeCompleto" | "telefone" | "endereco" | "bairro" | "geral", string>
>;

type PedidoConfirmado = {
  id: string;
  linkAcompanhamento: string;
  linkWhatsApp: string;
};

type PedidoHistorico = {
  id: string;
  criado_em: string;
  total: number;
  itens: Array<{
    id: string;
    nome: string;
    quantidade: number;
    preco: number;
    sabor?: string;
    escolhasCombo?: EscolhasCombo;
  }>;
};

const formasPagamento: Array<{ valor: FormaPagamento; rotulo: string }> = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "credito", rotulo: "Cartão de crédito" },
  { valor: "debito", rotulo: "Cartão de débito" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
];

const pagamentoVazio: Pagamento = {
  forma: "",
  valor: "",
  precisaTroco: null,
  trocoPara: "",
};

const WHATSAPP_GUETTO = "554491271708";
const GOOGLE_EMPRESA_URL = "https://share.google/yohBwgZriRO6w4SWp";

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const normalizarTexto = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ehEssencia = (produto: Pick<Produto, "nome">) =>
  normalizarTexto(produto.nome).startsWith("essencia");

const formatarNomeProduto = (nome: string) =>
  nome
    .replace(/\bcarvao\b/gi, "Carvão")
    .replace(/\benergetico\b/gi, "Energético")
    .replace(/\bimperio\b/gi, "Império")
    .replace(/\blimao\b/gi, "Limão")
    .replace(/^boa\s+agudos$/i, "Boa")
    .replace(/\s*-\s*agudos\s*-\s*caixa\s*12\s*latas/i, " - Caixa com 12")
    .replace(/\bpack\s*6\b/i, "Pack com 6")
    .replace(/\blong neck\b/i, "Long neck")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

const rotuloQuantidadeProduto = (produto: Produto) => {
  const nome = normalizarTexto(produto.nome);
  if (nome.includes("combo")) return "1 COMBO";
  if (nome === "gelo de sabor" || nome === "gelinho gourmet") return "1 UN";
  const unidades = produto.unidades_por_venda ?? 1;
  if (unidades > 1) return `${unidades} UN`;
  if (produto.tipo_venda === "caixa") return "CAIXA";
  return "1 UN";
};

const calcularSubtotalItem = (
  item: Pick<ItemCarrinho, "nome" | "preco" | "quantidade">
) => {
  if (item.nome.trim().toLowerCase() === "seda zomo") {
    const trios = Math.floor(item.quantidade / 3);
    const unidadesRestantes = item.quantidade % 3;
    return trios * 10 + unidadesRestantes * item.preco;
  }

  return item.preco * item.quantidade;
};

export default function Catalogo({
  categorias,
  produtos,
  tempoEntrega,
  horarioAbertura,
  horarioFechamento,
  somenteRetiradaConfigurada,
}: {
  categorias: Categoria[];
  produtos: Produto[];
  tempoEntrega: number;
  horarioAbertura: string;
  horarioFechamento: string;
  somenteRetiradaConfigurada: boolean;
}) {
  const categoriaInicial =
    produtos.some((produto) => produto.mais_vendido)
      ? "mais-vendidos"
      : produtos.some((produto) => produto.destaque)
        ? "destaques"
      : categorias.find((categoria) => categoria.nome === "Combos")?.id ??
    categorias[0]?.id ??
    null;
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(
    categoriaInicial
  );
  const [busca, setBusca] = useState("");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [etapaCheckout, setEtapaCheckout] = useState<EtapaCheckout>(1);
  const [maiorDeIdadeConfirmado, setMaiorDeIdadeConfirmado] = useState(false);
  const conteudoCheckoutRef = useRef<HTMLDivElement | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [carrinhoCarregado, setCarrinhoCarregado] = useState(false);
  const [ultimoPedido, setUltimoPedido] = useState<ItemCarrinho[]>([]);
  const [ultimoPedidoId, setUltimoPedidoId] = useState("");
  const [ultimoPedidoFoiAjustado, setUltimoPedidoFoiAjustado] = useState(false);
  const [dadosClienteRecuperados, setDadosClienteRecuperados] = useState(false);
  const [preferenciasCarregadas, setPreferenciasCarregadas] = useState(false);
  const [salvarDadosNoAparelho, setSalvarDadosNoAparelho] = useState(false);
  const [avisoCarrinho, setAvisoCarrinho] = useState("");
  const [confirmacaoProduto, setConfirmacaoProduto] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [referencia, setReferencia] = useState("");
  const [cidadeEntrega, setCidadeEntrega] = useState<"" | CidadeEntrega>("");
  const [seletorCidadeAberto, setSeletorCidadeAberto] = useState(false);
  const [abrirCheckoutAposCidade, setAbrirCheckoutAposCidade] = useState(false);
  const [errosCheckout, setErrosCheckout] = useState<ErrosCheckout>({});
  const [erroPagamento, setErroPagamento] = useState("");
  const [erroRevisao, setErroRevisao] = useState("");
  const [dividirPagamentoAberto, setDividirPagamentoAberto] = useState(false);
  const [cartaoEmEscolha, setCartaoEmEscolha] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null);
  const [quantidadePagamentos, setQuantidadePagamentos] =
    useState<QuantidadePagamentos>(1);
  const [primeiroPagamento, setPrimeiroPagamento] = useState<Pagamento>(pagamentoVazio);
  const [segundoPagamento, setSegundoPagamento] = useState<Pagamento>(pagamentoVazio);
  const [terceiroPagamento, setTerceiroPagamento] = useState<Pagamento>(pagamentoVazio);
  const [vasilhameConfirmado, setVasilhameConfirmado] = useState(false);
  const [comboEmConfiguracao, setComboEmConfiguracao] = useState<Produto | null>(null);
  const [saborAskov, setSaborAskov] = useState("");
  const [saborGinEternity, setSaborGinEternity] = useState("");
  const [saborEnergetico, setSaborEnergetico] = useState("");
  const [saboresGelo, setSaboresGelo] = useState<string[]>(Array(6).fill("Laranja"));
  const [saborWhisky, setSaborWhisky] = useState("Tradicional");
  const [geloEmConfiguracao, setGeloEmConfiguracao] = useState<Produto | null>(null);
  const [saborGeloAvulso, setSaborGeloAvulso] = useState("");
  const [quantidadeGeloAvulso, setQuantidadeGeloAvulso] = useState(1);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!confirmacaoProduto) return;
    const temporizador = window.setTimeout(
      () => setConfirmacaoProduto(""),
      1800
    );
    return () => window.clearTimeout(temporizador);
  }, [confirmacaoProduto]);

  useEffect(() => {
    try {
      const produtosAtuais = new Map(
        produtos.map((produto) => [produto.id, produto])
      );
      const reconciliarItens = (valorSalvo: string) => {
        const itensSalvos = JSON.parse(valorSalvo) as ItemCarrinho[];
        let foiAjustado = false;
        const itensAtualizados = Array.isArray(itensSalvos)
          ? itensSalvos.flatMap((item) => {
              const produtoAtual = produtosAtuais.get(item.id);
              if (!produtoAtual) {
                foiAjustado = true;
                return [];
              }

              const estoqueGeral =
                produtoAtual.grupo_estoque &&
                typeof produtoAtual.estoque_unidades === "number"
                  ? Math.floor(
                      produtoAtual.estoque_unidades /
                        (produtoAtual.unidades_por_venda || 1)
                    )
                  : produtoAtual.estoque;
              const estoqueAtual =
                item.sabor && produtoAtual.estoque_opcoes
                  ? produtoAtual.estoque_opcoes[item.sabor] ?? 0
                  : estoqueGeral;
              const quantidade = Math.min(item.quantidade, estoqueAtual);

              if (
                quantidade < 1 ||
                quantidade !== item.quantidade ||
                Number(item.preco) !== Number(produtoAtual.preco)
              ) {
                foiAjustado = true;
              }
              if (quantidade < 1) return [];

              return [
                {
                  ...produtoAtual,
                  quantidade,
                  sabor: item.sabor,
                  escolhasCombo: item.escolhasCombo,
                },
              ];
            })
          : [];

        return { itensAtualizados, foiAjustado };
      };

      const salvo = window.localStorage.getItem("guetto_carrinho");
      if (salvo) {
        const { itensAtualizados, foiAjustado: carrinhoFoiAjustado } =
          reconciliarItens(salvo);
        setCarrinho(itensAtualizados);
        if (carrinhoFoiAjustado) {
          setAvisoCarrinho(
            "Atualizamos seu carrinho conforme os preços e estoques atuais."
          );
        }
      }

      const ultimoPedidoSalvo = window.localStorage.getItem(
        "guetto_ultimo_pedido"
      );
      if (ultimoPedidoSalvo) {
        const { itensAtualizados, foiAjustado } =
          reconciliarItens(ultimoPedidoSalvo);
        setUltimoPedido(itensAtualizados);
        setUltimoPedidoFoiAjustado(foiAjustado);
      }

      const ultimoPedidoIdSalvo = window.localStorage.getItem(
        "guetto_ultimo_pedido_id"
      );
      if (ultimoPedidoIdSalvo) setUltimoPedidoId(ultimoPedidoIdSalvo);

      if (window.localStorage.getItem("guetto_abrir_carrinho") === "1") {
        setEtapaCheckout(1);
        setCarrinhoAberto(true);
        window.localStorage.removeItem("guetto_abrir_carrinho");
      }
    } catch {
      window.localStorage.removeItem("guetto_carrinho");
    } finally {
      setCarrinhoCarregado(true);
    }
  }, [produtos]);

  useEffect(() => {
    if (!carrinhoCarregado) return;
    window.localStorage.setItem("guetto_carrinho", JSON.stringify(carrinho));
  }, [carrinho, carrinhoCarregado]);

  useEffect(() => {
    try {
      const dadosSalvos = window.localStorage.getItem(
        "guetto_dados_cliente"
      );
      if (!dadosSalvos) {
        const cidadeSalva = window.localStorage.getItem("guetto_cidade");
        if (
          CIDADES_ENTREGA.some((cidade) => cidade.nome === cidadeSalva)
        ) {
          setCidadeEntrega(cidadeSalva as CidadeEntrega);
        }
        return;
      }

      const dados = JSON.parse(dadosSalvos) as DadosClienteSalvos;
      setNomeCompleto(
        dados.nomeCompleto ??
          [dados.nome, dados.sobrenome].filter(Boolean).join(" ")
      );
      setTelefone(dados.telefone ?? "");
      setEndereco(
        dados.endereco ??
          [dados.rua, dados.numeroEndereco].filter(Boolean).join(", ")
      );
      const cidadeSalva = dados.cidadeEntrega ?? "";
      setBairro(
        cidadeSalva && ehBairroEntrega(cidadeSalva, dados.bairro)
          ? dados.bairro
          : ""
      );
      setReferencia(dados.referencia ?? "");
      setCidadeEntrega(dados.cidadeEntrega ?? "");
      setDadosClienteRecuperados(true);
      setSalvarDadosNoAparelho(true);
    } catch {
      window.localStorage.removeItem("guetto_dados_cliente");
    } finally {
      setPreferenciasCarregadas(true);
    }
  }, []);

  function estoqueDisponivel(produto: Produto) {
    if (produto.grupo_estoque && typeof produto.estoque_unidades === "number") {
      return Math.floor(produto.estoque_unidades / (produto.unidades_por_venda || 1));
    }
    return produto.estoque;
  }

  const categoriaCervejasId = categorias.find(
    (categoria) => normalizarTexto(categoria.nome) === "cervejas"
  )?.id;

  const produtosFiltrados = useMemo(
    () => {
      const termo = normalizarTexto(busca);
      const filtrados = produtos.filter((produto) => {
        const correspondeCategoria =
          termo.length > 0 ||
          (categoriaAtiva === "mais-vendidos"
            ? produto.mais_vendido
            : categoriaAtiva === "destaques"
              ? produto.destaque
              : produto.categoria_id === categoriaAtiva);
        const textoProduto = normalizarTexto(
          `${produto.nome} ${produto.descricao ?? ""}`
        );
        return correspondeCategoria && (!termo || textoProduto.includes(termo));
      });

      return categoriaAtiva === "mais-vendidos" && !termo
        ? filtrados
            .filter(
              (produto) =>
                estoqueDisponivel(produto) > 0 &&
                !(
                  produto.categoria_id === categoriaCervejasId &&
                  produto.tipo_venda === "avulso"
                )
            )
            .sort(
              (produtoA, produtoB) => {
                const caixaCervejaA =
                  produtoA.categoria_id === categoriaCervejasId &&
                  produtoA.tipo_venda === "caixa"
                    ? 0
                    : 1;
                const caixaCervejaB =
                  produtoB.categoria_id === categoriaCervejasId &&
                  produtoB.tipo_venda === "caixa"
                    ? 0
                    : 1;
                return (
                  caixaCervejaA - caixaCervejaB ||
                  Number(produtoA.posicao_mais_vendido ?? 999) -
                    Number(produtoB.posicao_mais_vendido ?? 999)
                );
              }
            )
            .slice(0, 8)
        : filtrados;
    },
    [busca, categoriaAtiva, produtos, categoriaCervejasId]
  );
  const categoriaTabacariaId = categorias.find(
    (categoria) => normalizarTexto(categoria.nome) === "tabacaria"
  )?.id;
  const exibirSubsecoesTabacaria =
    !busca.trim() && categoriaAtiva === categoriaTabacariaId;
  const secoesProdutos = exibirSubsecoesTabacaria
    ? [
        {
          id: "essencias",
          titulo: "Essências",
          descricao:
            "Escolha a marca e depois o sabor. Cada essência pode ter sua própria foto cadastrada.",
          produtos: produtosFiltrados.filter(ehEssencia),
        },
        {
          id: "outros-tabacaria",
          titulo: "Outros produtos de tabacaria",
          descricao: "Acessórios, carvão, sedas e outros itens.",
          produtos: produtosFiltrados.filter((produto) => !ehEssencia(produto)),
        },
      ].filter((secao) => secao.produtos.length > 0)
    : [
        {
          id: "produtos",
          titulo: "",
          descricao: "",
          produtos: produtosFiltrados,
        },
      ];

  const quantidadeTotal = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0
  );
  const valorTotal = carrinho.reduce(
    (total, item) => total + calcularSubtotalItem(item),
    0
  );
  const tercaFeira =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    }).format(agora) === "Tue";
  const somenteRetiradaHoje = somenteRetiradaConfigurada || tercaFeira;

  useEffect(() => {
    if (!somenteRetiradaHoje) return;
    setCarrinhoAberto(false);
    setRevisaoAberta(false);
    setGeloEmConfiguracao(null);
    setComboEmConfiguracao(null);
  }, [somenteRetiradaHoje]);
  const categoriaPorIdAtual = new Map(
    categorias.map((categoria) => [
      categoria.id,
      categoria.nome.trim().toLowerCase(),
    ])
  );
  const avaliacaoPedidoMinimo = avaliarPedidoMinimo(
    carrinho.map((item) => ({
      categoria: categoriaPorIdAtual.get(item.categoria_id) ?? "",
      tipoVenda: item.tipo_venda,
      nome: item.nome,
      descricao: item.descricao,
      subtotal: calcularSubtotalItem(item),
    })),
    cidadeEntrega || null
  );
  const avaliacaoPedidoMinimoLongNeck = avaliarPedidoMinimoLongNeck(
    carrinho.map((item) => ({
      categoria: categoriaPorIdAtual.get(item.categoria_id) ?? "",
      tipoVenda: item.tipo_venda,
      nome: item.nome,
      descricao: item.descricao,
      subtotal: calcularSubtotalItem(item),
      quantidade: item.quantidade,
    })),
    cidadeEntrega || null
  );
  const pedidoMinimoAtual = somenteRetiradaHoje
    ? 0
    : avaliacaoPedidoMinimo.minimoReferencia;
  const faltaPedidoMinimo = somenteRetiradaHoje
    ? 0
    : avaliacaoPedidoMinimo.falta;
  const progressoPedidoMinimo =
    pedidoMinimoAtual === null
      ? 0
      : pedidoMinimoAtual === 0
        ? 100
      : Math.min(
          100,
          (avaliacaoPedidoMinimo.valorConsiderado / pedidoMinimoAtual) * 100
        );
  const totalPagamentosInformado = [
    primeiroPagamento,
    segundoPagamento,
    terceiroPagamento,
  ]
    .slice(0, quantidadePagamentos)
    .reduce(
      (total, pagamento) => total + valorNumerico(pagamento.valor),
      0
    );
  const valorRestantePagamento = Math.max(
    0,
    valorTotal - totalPagamentosInformado
  );
  const valorExcedentePagamento = Math.max(
    0,
    totalPagamentosInformado - valorTotal
  );
  const quantidadeGarrafas300 = carrinho
    .filter((item) => item.nome.toLowerCase().includes("garrafa 300ml"))
    .reduce((total, item) => total + item.quantidade, 0);

  const saboresAskov = produtos
    .filter((produto) => produto.nome.startsWith("Askov 1L - "))
    .map((produto) => produto.nome.replace("Askov 1L - ", ""));
  const ginEternity = produtos.find(
    (produto) => normalizarTexto(produto.nome) === "gin eternity"
  );
  const saboresGinEternity = Object.entries(
    ginEternity?.estoque_opcoes ?? {}
  )
    .filter(([, estoque]) => estoque > 0)
    .map(([sabor]) => sabor);
  const saboresEnergetico = produtos
    .filter(
      (produto) =>
        produto.nome.startsWith("Furioso 2L - ") &&
        estoqueDisponivel(produto) > 0
    )
    .map((produto) => produto.nome.replace("Furioso 2L - ", ""));
  const saboresDeGelo = ["Laranja", "Maca Verde", "Limao", "Morango", "Coco", "Maracuja", "Melancia", "Uva Verde", "Amora", "Abacaxi", "Sal e Limao", "Brisa"];
  const produtoJackDaniels = produtos.find(
    (produto) => produto.nome.trim().toLowerCase() === "whisky jack daniels"
  );
  const saboresWhiskyJack = ["Tradicional", "Fire", "Maçã Verde", "Mel"].filter(
    (sabor) => (produtoJackDaniels?.estoque_opcoes?.[sabor] ?? 1) > 0
  );

  const horarioAtual = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(agora);
  const paraMinutos = (horario: string) => {
    const [hora, minuto] = horario.split(":").map(Number);
    return hora * 60 + minuto;
  };
  const horarioConfigurado = Boolean(horarioAbertura && horarioFechamento);
  const minutosAgora = paraMinutos(horarioAtual);
  const minutosAbertura = horarioConfigurado ? paraMinutos(horarioAbertura) : 0;
  const minutosFechamento = horarioConfigurado ? paraMinutos(horarioFechamento) : 0;
  const atendimentoAberto = horarioConfigurado && (minutosAbertura <= minutosFechamento
    ? minutosAgora >= minutosAbertura && minutosAgora < minutosFechamento
    : minutosAgora >= minutosAbertura || minutosAgora < minutosFechamento);

  useEffect(() => {
    if (
      preferenciasCarregadas &&
      atendimentoAberto &&
      !somenteRetiradaHoje &&
      !cidadeEntrega
    ) {
      setSeletorCidadeAberto(true);
    }
  }, [
    preferenciasCarregadas,
    atendimentoAberto,
    somenteRetiradaHoje,
    cidadeEntrega,
  ]);

  function escolherCidade(cidade: CidadeEntrega) {
    setCidadeEntrega(cidade);
    setBairro((bairroAtual) =>
      ehBairroEntrega(cidade, bairroAtual) ? bairroAtual : ""
    );
    window.localStorage.setItem("guetto_cidade", cidade);
    setSeletorCidadeAberto(false);
    setErrosCheckout((erros) => ({ ...erros, geral: undefined }));
    if (abrirCheckoutAposCidade) {
      setAbrirCheckoutAposCidade(false);
      setEtapaCheckout(1);
      window.requestAnimationFrame(() => setCarrinhoAberto(true));
    }
  }

  function abrirCarrinhoParaPedido() {
    if (!cidadeEntrega) {
      setAbrirCheckoutAposCidade(true);
      setSeletorCidadeAberto(true);
      return;
    }
    setEtapaCheckout(1);
    setCarrinhoAberto(true);
  }

  function chaveItem(item: Produto & { sabor?: string; escolhasCombo?: EscolhasCombo }) {
    return `${item.id}:${item.sabor ?? ""}:${item.escolhasCombo ? JSON.stringify(item.escolhasCombo) : ""}`;
  }

  function repetirUltimoPedido() {
    if (somenteRetiradaHoje) return;
    if (ultimoPedido.length === 0) return;
    if (
      carrinho.length > 0 &&
      !window.confirm(
        "Seu carrinho atual será substituído pelo último pedido. Deseja continuar?"
      )
    ) {
      return;
    }

    setCarrinho(ultimoPedido);
    abrirCarrinhoParaPedido();
    if (ultimoPedidoFoiAjustado) {
      setAvisoCarrinho(
        "Alguns itens do último pedido foram ajustados conforme o estoque e os preços atuais."
      );
    }
  }

  function acompanharPedido() {
    if (ultimoPedidoId) {
      window.location.assign(`/acompanhar/${ultimoPedidoId}`);
      return;
    }

    const linkOuCodigo = window.prompt(
      "Cole aqui o link de acompanhamento recebido no WhatsApp:"
    );
    if (!linkOuCodigo) return;

    const pedidoId = linkOuCodigo.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
    )?.[0];
    if (!pedidoId) {
      alert("Link de acompanhamento inválido.");
      return;
    }

    window.localStorage.setItem("guetto_ultimo_pedido_id", pedidoId);
    setUltimoPedidoId(pedidoId);
    window.location.assign(`/acompanhar/${pedidoId}`);
  }

  function alterarQuantidade(produto: Produto & { sabor?: string; escolhasCombo?: EscolhasCombo }, alteracao: number) {
    if (somenteRetiradaHoje) return;
    if (alteracao > 0) {
      setConfirmacaoProduto(`${formatarNomeProduto(produto.nome)} ADICIONADO ✓`);
    }
    setCarrinho((itens) => {
      const chave = chaveItem(produto);
      const itemAtual = itens.find((item) => chaveItem(item) === chave);
      const estoqueGinSelecionado =
        produto.nome.toLowerCase().includes("gin eternity") &&
        produto.escolhasCombo?.whisky
          ? ginEternity?.estoque_opcoes?.[produto.escolhasCombo.whisky]
          : undefined;
      const estoqueMaximo =
        estoqueGinSelecionado ??
        (produto.sabor
          ? produto.estoque_opcoes?.[produto.sabor] ?? estoqueDisponivel(produto)
          : estoqueDisponivel(produto));

      if (!itemAtual && alteracao > 0) {
        return [...itens, { ...produto, quantidade: 1 }];
      }

      return itens
        .map((item) =>
          chaveItem(item) === chave
            ? {
                ...item,
                quantidade: Math.min(
                  estoqueMaximo,
                  Math.max(0, item.quantidade + alteracao)
                ),
              }
            : item
        )
        .filter((item) => item.quantidade > 0);
    });
  }

  function saboresDoProduto(produto: Produto) {
    if (produto.estoque_opcoes) {
      return Object.entries(produto.estoque_opcoes)
        .filter(([, estoque]) => estoque > 0)
        .map(([sabor]) => sabor);
    }

    if (produto.nome.toLowerCase().includes("jack daniel")) {
      return ["Maçã Verde", "Fire", "Mel", "Tradicional"].filter(
        (sabor) => (produto.estoque_opcoes?.[sabor] ?? 1) > 0
      );
    }

    return (produto.descricao ?? "")
      .replace(/\s+ou\s+/gi, ",")
      .split(",")
      .map((sabor) => sabor.trim())
      .filter(Boolean);
  }

  function abrirConfiguracaoGelo(produto: Produto) {
    if (somenteRetiradaHoje) return;
    const sabores = saboresDoProduto(produto);
    setGeloEmConfiguracao(produto);
    setSaborGeloAvulso(sabores[0] ?? "");
    setQuantidadeGeloAvulso(1);
  }

  function confirmarGelo() {
    if (!geloEmConfiguracao || !saborGeloAvulso) return;

    const estoqueDoSabor =
      geloEmConfiguracao.estoque_opcoes?.[saborGeloAvulso] ??
      estoqueDisponivel(geloEmConfiguracao);
    const quantidade = Math.min(
      estoqueDoSabor,
      Math.max(1, quantidadeGeloAvulso)
    );
    const novoItem = {
      ...geloEmConfiguracao,
      sabor: saborGeloAvulso,
      quantidade,
    };

    setCarrinho((itens) => {
      const chave = chaveItem(novoItem);
      const existente = itens.find((item) => chaveItem(item) === chave);

      if (!existente) return [...itens, novoItem];

      return itens.map((item) =>
        chaveItem(item) === chave
          ? {
              ...item,
              quantidade: Math.min(
                estoqueDoSabor,
                item.quantidade + quantidade
              ),
            }
          : item
      );
    });
    setConfirmacaoProduto(
      `${formatarNomeProduto(geloEmConfiguracao.nome)} ADICIONADO ✓`
    );
    setGeloEmConfiguracao(null);
  }

  function abrirConfiguracaoCombo(produto: Produto) {
    if (somenteRetiradaHoje) return;
    setSaborAskov(saboresAskov[0] ?? "Tradicional");
    setSaborGinEternity(saboresGinEternity[0] ?? "");
    setSaborEnergetico(saboresEnergetico[0] ?? "Tradicional");
    setSaboresGelo(Array(6).fill(saboresDeGelo[0]));
    setSaborWhisky(saboresWhiskyJack[0] ?? "");
    setComboEmConfiguracao(produto);
  }

  function confirmarCombo() {
    if (
      !comboEmConfiguracao ||
      !saborEnergetico ||
      (comboEmConfiguracao.nome.toLowerCase().includes("askov") &&
        !saborAskov) ||
      (comboEmConfiguracao.nome.toLowerCase().includes("gin eternity") &&
        !saborGinEternity)
    )
      return;
    const escolhas: EscolhasCombo = {
      energetico: saborEnergetico,
      gelos: saboresGelo,
      ...(comboEmConfiguracao.nome.toLowerCase().includes("askov") ? { askov: saborAskov } : {}),
      ...(comboEmConfiguracao.nome.toLowerCase().includes("gin eternity")
        ? { whisky: saborGinEternity }
        : {}),
      ...(comboEmConfiguracao.nome.toLowerCase().includes("jack daniel") ? { whisky: saborWhisky } : {}),
    };
    setCarrinho((itens) => [...itens, { ...comboEmConfiguracao, quantidade: 1, escolhasCombo: escolhas }]);
    setConfirmacaoProduto(
      `${formatarNomeProduto(comboEmConfiguracao.nome)} ADICIONADO ✓`
    );
    setComboEmConfiguracao(null);
  }

  function valorNumerico(valor: string) {
    const numero = Number(valor.replace(",", "."));
    return Number.isFinite(numero) ? numero : 0;
  }

  function resumoPagamento(pagamento: Pagamento, valor: number) {
    const rotulo = formasPagamento.find((forma) => forma.valor === pagamento.forma)?.rotulo;
    const troco = pagamento.forma !== "dinheiro"
      ? ""
      : pagamento.precisaTroco === true
        ? ` (troco para ${formatarPreco(valorNumerico(pagamento.trocoPara))})`
        : pagamento.precisaTroco === false
          ? " (não precisa de troco)"
          : "";
    return `${rotulo}: ${formatarPreco(valor)}${troco}`;
  }

  function pagamentosSelecionados() {
    return [
      primeiroPagamento,
      segundoPagamento,
      terceiroPagamento,
    ].slice(0, quantidadePagamentos);
  }

  function exibirErrosCheckout(erros: ErrosCheckout) {
    setErrosCheckout(erros);
    const primeiroCampo = ([
      "nomeCompleto",
      "telefone",
      "endereco",
      "bairro",
    ] as const).find((campo) => erros[campo]);
    if (!primeiroCampo) return;
    const nomesCampos: Record<Exclude<keyof ErrosCheckout, "geral">, string> = {
      nomeCompleto: "nome-completo",
      telefone: "telefone",
      endereco: "endereco",
      bairro: "bairro",
    };
    window.requestAnimationFrame(() => {
      const campo = document.querySelector<HTMLInputElement>(
        `[name="${nomesCampos[primeiroCampo]}"]`
      );
      campo?.focus();
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function validarIdentificacaoEEndereco() {
    if (somenteRetiradaHoje) {
      exibirErrosCheckout({
        geral:
          "Hoje não há delivery. As compras devem ser feitas pessoalmente na loja.",
      });
      return false;
    }

    if (!atendimentoAberto) {
      exibirErrosCheckout({ geral: "A Guetto Delivery está fechada agora." });
      return false;
    }
    if (carrinho.length === 0) {
      exibirErrosCheckout({ geral: "Seu carrinho está vazio." });
      return false;
    }

    if (!cidadeEntrega) {
      exibirErrosCheckout({ geral: "ESCOLHA A CIDADE DA ENTREGA." });
      setAbrirCheckoutAposCidade(false);
      setSeletorCidadeAberto(true);
      return false;
    }

    const erros: ErrosCheckout = {};
    if (nomeCompleto.trim().split(/\s+/).length < 2) {
      erros.nomeCompleto = "DIGITE SEU NOME E SOBRENOME.";
    }
    const telefoneNumeros = telefone.replace(/\D/g, "");
    if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
      erros.telefone = "DIGITE UM WHATSAPP COM DDD.";
    }
    if (endereco.trim().length < 4) {
      erros.endereco = "DIGITE A RUA E O NÚMERO.";
    }
    if (!bairro || !ehBairroEntrega(cidadeEntrega, bairro)) {
      erros.bairro = "ESCOLHA O BAIRRO.";
    }
    if (Object.keys(erros).length > 0) {
      exibirErrosCheckout(erros);
      return false;
    }

    if (!avaliacaoPedidoMinimoLongNeck.atingido) {
      exibirErrosCheckout({
        geral: mensagemPedidoMinimoLongNeck(avaliacaoPedidoMinimoLongNeck),
      });
      return false;
    }

    if (!somenteRetiradaHoje && !avaliacaoPedidoMinimo.atingido) {
      exibirErrosCheckout({
        geral: mensagemPedidoMinimo(
          avaliacaoPedidoMinimo,
          cidadeEntrega as CidadeEntrega
        ),
      });
      return false;
    }

    if (quantidadeGarrafas300 > 0 && quantidadeGarrafas300 < 10) {
      exibirErrosCheckout({
        geral: "GARRAFAS DE 300 ML: O MÍNIMO É 10 UNIDADES.",
      });
      return false;
    }

    if (quantidadeGarrafas300 > 0 && !vasilhameConfirmado) {
      exibirErrosCheckout({
        geral: "CONFIRME QUE VOCÊ VAI LEVAR O VASILHAME.",
      });
      return false;
    }

    setErrosCheckout({});
    return true;
  }

  function validarPagamento() {
    const pagamentos = pagamentosSelecionados();

    if (pagamentos.some((pagamento) => !pagamento.forma)) {
      setErroPagamento(
        cartaoEmEscolha
          ? "ESCOLHA CRÉDITO OU DÉBITO."
          : "ESCOLHA COMO VAI PAGAR."
      );
      return false;
    }

    if (quantidadePagamentos > 1) {
      const soma = pagamentos.reduce((total, pagamento) => total + valorNumerico(pagamento.valor), 0);
      if (pagamentos.some((pagamento) => !pagamento.valor || valorNumerico(pagamento.valor) <= 0) || Math.abs(soma - valorTotal) > 0.01) {
        setErroPagamento(
          `OS VALORES PRECISAM SOMAR ${formatarPreco(valorTotal)}.`
        );
        return false;
      }
    }

    if (pagamentos.some((pagamento) => pagamento.forma === "dinheiro" && pagamento.precisaTroco === null)) {
      setErroPagamento("DIGA SE PRECISA DE TROCO.");
      return false;
    }

    if (pagamentos.some((pagamento) => pagamento.forma === "dinheiro" && pagamento.precisaTroco && valorNumerico(pagamento.trocoPara) <= 0)) {
      setErroPagamento("DIGITE O VALOR PARA O TROCO.");
      return false;
    }

    setErroPagamento("");
    return true;
  }

  function mudarEtapaCheckout(etapa: EtapaCheckout) {
    setEtapaCheckout(etapa);
    window.requestAnimationFrame(() =>
      conteudoCheckoutRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    );
  }

  function avancarParaPagamento() {
    if (!validarIdentificacaoEEndereco()) return;
    mudarEtapaCheckout(2);
  }

  async function finalizarPedido(confirmado = false) {
    if (enviandoPedido) return;
    if (!validarIdentificacaoEEndereco() || !validarPagamento()) return;

    const pagamentos = pagamentosSelecionados();

    if (!confirmado) {
      setMaiorDeIdadeConfirmado(false);
      setErroRevisao("");
      setCarrinhoAberto(false);
      setRevisaoAberta(true);
      return;
    }

    if (!maiorDeIdadeConfirmado) {
      setErroRevisao("CONFIRME QUE VOCÊ TEM 18 ANOS OU MAIS.");
      return;
    }

    const linhas = carrinho.map(
      (item) =>
        `${item.quantidade}x ${formatarNomeProduto(item.nome)} — ${formatarPreco(
          calcularSubtotalItem(item)
        )}${item.sabor ? `\n   Sabor: ${item.sabor}` : ""}${item.escolhasCombo ? `\n   Escolhas: ${[
          item.escolhasCombo.askov ? `Askov ${item.escolhasCombo.askov}` : "",
          item.escolhasCombo.whisky && item.nome.toLowerCase().includes("gin eternity")
            ? `Gin Eternity ${item.escolhasCombo.whisky}`
            : "",
          `Energético ${item.escolhasCombo.energetico}`,
          `6 gelos: ${item.escolhasCombo.gelos.join(", ")}`,
          item.escolhasCombo.whisky && item.nome.toLowerCase().includes("jack daniel")
            ? `Whisky Jack Daniel's ${item.escolhasCombo.whisky}`
            : "",
        ].filter(Boolean).join(" | ")}` : ""}`
    );
    const pagamentosFormatados = pagamentos.map((pagamento) =>
      resumoPagamento(pagamento, quantidadePagamentos > 1 ? valorNumerico(pagamento.valor) : valorTotal)
    );
    const pedido = [
      "Olá! Gostaria de fazer este pedido:",
      "",
      `Cliente: ${nomeCompleto.trim()}`,
      `Telefone: ${telefone.trim()}`,
      ...(somenteRetiradaHoje ? ["Atendimento: Retirada na loja"] : []),
      ...(!somenteRetiradaHoje
        ? [
            `Cidade: ${cidadeEntrega}`,
            `Endereço: ${endereco.trim()}`,
            `Bairro: ${bairro.trim()}`,
            ...(referencia.trim()
              ? [`Referência: ${referencia.trim()}`]
              : []),
          ]
        : []),
      "",
      ...linhas,
      "",
      `Total: ${formatarPreco(valorTotal)}`,
      somenteRetiradaHoje
        ? "Retirada: avisem pelo WhatsApp quando o pedido estiver pronto."
        : `Previsão de entrega: até ${tempoEntrega} minutos`,
      "Maioridade: cliente confirmou ter 18 anos ou mais.",
      ...(quantidadeGarrafas300 > 0 ? ["Vasilhame: cliente confirmou que levará o próprio."] : []),
      "Pagamento:",
      ...pagamentosFormatados.map((pagamento) => `- ${pagamento}`),
    ].join("\n");

    setEnviandoPedido(true);
    try {
      const respostaPedido = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_nome: nomeCompleto.trim(),
          telefone: telefone.trim(),
          tipo_atendimento: somenteRetiradaHoje ? "retirada" : "delivery",
          endereco: somenteRetiradaHoje
            ? "Retirada na loja"
            : endereco.trim(),
          bairro: somenteRetiradaHoje ? null : bairro.trim(),
          referencia: somenteRetiradaHoje ? null : referencia.trim() || null,
          cidade_entrega: somenteRetiradaHoje ? null : cidadeEntrega,
          vasilhame_confirmado: vasilhameConfirmado,
          itens: carrinho.map((item) => ({
            produto_id: item.id,
            quantidade: item.quantidade,
            escolhas_combo: item.sabor
              ? { sabor: item.sabor }
              : item.escolhasCombo ?? null,
          })),
          pagamento: pagamentosFormatados,
          troco: pagamentos.map((pagamento) =>
            pagamento.forma === "dinheiro"
              ? {
                  precisa_troco: pagamento.precisaTroco,
                  troco_para: pagamento.precisaTroco
                    ? valorNumerico(pagamento.trocoPara)
                    : null,
                }
              : null
          ),
          tempo_entrega: tempoEntrega,
          observacao: [
            somenteRetiradaHoje
              ? "Atendimento: retirada na loja."
              : `Cidade de entrega: ${cidadeEntrega}.`,
            "Cliente confirmou ter 18 anos ou mais.",
            ...(quantidadeGarrafas300 > 0 ? ["Vasilhame confirmado pelo cliente."] : []),
          ].join(" "),
        }),
      });

      if (!respostaPedido.ok) {
        const erro = await respostaPedido.json().catch(() => null);
        setErroRevisao(
          erro?.error ?? "NÃO FOI POSSÍVEL CONFIRMAR. TENTE NOVAMENTE."
        );
        return;
      }

      const pedidoRegistrado = await respostaPedido.json();
      const pedidoId = String(pedidoRegistrado.id);
      const pedidoCriadoEm = new Date().toISOString();
      const linkAcompanhamento = `${window.location.origin}/acompanhar/${pedidoId}`;
      const pedidoFinal = `${pedido}\n\nAcompanhe seu pedido:\n${linkAcompanhamento}`;
      const linkWhatsApp = `https://wa.me/${WHATSAPP_GUETTO}?text=${encodeURIComponent(pedidoFinal)}`;

      const dadosCliente: DadosClienteSalvos = {
        nomeCompleto: nomeCompleto.trim(),
        telefone: telefone.trim(),
        endereco: endereco.trim(),
        bairro: bairro.trim(),
        referencia: referencia.trim(),
        cidadeEntrega,
      };
      if (salvarDadosNoAparelho) {
        window.localStorage.setItem(
          "guetto_dados_cliente",
          JSON.stringify(dadosCliente)
        );
      } else {
        window.localStorage.removeItem("guetto_dados_cliente");
      }
      window.localStorage.setItem(
        "guetto_ultimo_pedido",
        JSON.stringify(carrinho)
      );
      window.localStorage.setItem("guetto_ultimo_pedido_id", pedidoId);
      window.localStorage.setItem(
        "guetto_ultimo_pedido_criado_em",
        pedidoCriadoEm
      );
      try {
        const historicoSalvo = JSON.parse(
          window.localStorage.getItem("guetto_historico_pedidos") ?? "[]"
        ) as PedidoHistorico[];
        const novoRegistro: PedidoHistorico = {
          id: pedidoId,
          criado_em: pedidoCriadoEm,
          total: valorTotal,
          itens: carrinho.map((item) => ({
            id: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            preco: item.preco,
            sabor: item.sabor,
            escolhasCombo: item.escolhasCombo,
          })),
        };
        const historicoAtualizado = [
          novoRegistro,
          ...(Array.isArray(historicoSalvo)
            ? historicoSalvo.filter((registro) => registro.id !== pedidoId)
            : []),
        ];
        window.localStorage.setItem(
          "guetto_historico_pedidos",
          JSON.stringify(historicoAtualizado)
        );
      } catch {
        // O histórico local é uma conveniência e não pode impedir o pedido.
      }
      setUltimoPedido(carrinho);
      setUltimoPedidoId(pedidoId);
      setUltimoPedidoFoiAjustado(false);
      window.localStorage.setItem("guetto_carrinho", "[]");
      setCarrinho([]);
      setRevisaoAberta(false);
      setEtapaCheckout(1);
      setMaiorDeIdadeConfirmado(false);
      setErroRevisao("");
      setPedidoConfirmado({
        id: pedidoId,
        linkAcompanhamento,
        linkWhatsApp,
      });

      try {
        await navigator.clipboard.writeText(pedidoFinal);
      } catch {
        // Copiar é apenas uma conveniência e não pode impedir a abertura do WhatsApp.
      }

      window.location.assign(linkWhatsApp);
    } catch {
      setErroRevisao(
        "NÃO FOI POSSÍVEL CONFIRMAR. VERIFIQUE SUA INTERNET E TENTE DE NOVO."
      );
    } finally {
      setEnviandoPedido(false);
    }
  }

  function IndicadorPedidoMinimo({
    compacto = false,
  }: {
    compacto?: boolean;
  }) {
    if (carrinho.length === 0) return null;

    if (somenteRetiradaHoje) {
      return (
        <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 shrink-0 text-yellow-400" size={17} />
            <div>
              <p className="font-bold">Somente retirada na loja</p>
              {!compacto && (
                <p className="mt-0.5 text-xs text-zinc-300">
                  Hoje não realizamos delivery e não há mínimo de entrega.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`rounded-xl border p-3 ${
          faltaPedidoMinimo === 0
            ? "border-green-500/50 bg-green-950/40"
            : "border-yellow-400/40 bg-yellow-400/10"
        }`}
      >
        {pedidoMinimoAtual === null ? (
          <div className="flex items-start gap-2 text-sm text-yellow-100">
            <MapPin className="mt-0.5 shrink-0 text-yellow-400" size={17} />
            <div>
              <p className="font-bold">Escolha sua cidade</p>
              {!compacto && (
                <p className="mt-0.5 text-xs text-zinc-300">
                  Assim mostramos quanto falta para o pedido mínimo.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p
                className={`font-bold ${
                  faltaPedidoMinimo === 0
                    ? "text-green-300"
                    : "text-yellow-100"
                }`}
              >
                {faltaPedidoMinimo === 0
                  ? "PRONTO PARA PEDIR ✓"
                  : `FALTAM ${formatarPreco(faltaPedidoMinimo ?? 0)}`}
              </p>
              {!compacto && (
                <span className="shrink-0 text-xs text-zinc-400">
                  Mínimo {formatarPreco(pedidoMinimoAtual)}
                </span>
              )}
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-label="Progresso para o pedido mínimo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressoPedidoMinimo)}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  faltaPedidoMinimo === 0 ? "bg-green-500" : "bg-yellow-400"
                }`}
                style={{ width: `${progressoPedidoMinimo}%` }}
              />
            </div>
            {!compacto && avaliacaoPedidoMinimo.temLataCervejaAvulsa && (
              <p className="mt-2 text-xs text-zinc-300">
                {avaliacaoPedidoMinimo.liberadoPor === "caixa_cerveja"
                  ? "Latas avulsas liberadas pela caixa/pack fechado de cerveja."
                  : "Latas avulsas não entram nessa soma. Também liberamos com R$ 20,00 em tabacaria ou uma caixa/pack fechado de cerveja."}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  const detalheSaborSelecionado =
    geloEmConfiguracao?.detalhes_opcoes?.[saborGeloAvulso];

  return (
    <section
      className={`mx-auto max-w-[90rem] px-4 py-5 sm:px-5 sm:py-8 ${
        somenteRetiradaHoje ? "pb-12" : "pb-28 xl:pr-[21rem]"
      }`}
    >
      {confirmacaoProduto && (
        <div
          className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-green-500 px-5 py-4 text-center font-black text-black shadow-2xl"
          role="status"
          aria-live="polite"
        >
          {confirmacaoProduto}
        </div>
      )}

      {!somenteRetiradaHoje && seletorCidadeAberto && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-cidade"
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-yellow-400 bg-zinc-950 p-5 shadow-2xl sm:p-7">
            <MapPin className="mx-auto text-yellow-400" size={42} />
            <h2
              id="titulo-cidade"
              className="mt-3 text-center text-3xl font-black text-white"
            >
              ONDE VOCÊ ESTÁ?
            </h2>
            <p className="mt-2 text-center text-zinc-300">
              Toque na cidade da entrega.
            </p>
            <div className="mt-5 grid gap-3">
              {CIDADES_ENTREGA.map((cidade) => (
                <button
                  key={cidade.nome}
                  type="button"
                  onClick={() => escolherCidade(cidade.nome)}
                  className="min-h-16 rounded-2xl bg-yellow-400 px-4 py-3 text-xl font-black text-black hover:bg-yellow-300"
                >
                  {cidade.nome}
                  <span className="mt-1 block text-xs font-bold">
                    PEDIDO MÍNIMO {formatarPreco(cidade.pedidoMinimo)}
                  </span>
                </button>
              ))}
            </div>
            {!abrirCheckoutAposCidade && (
              <button
                type="button"
                onClick={() => setSeletorCidadeAberto(false)}
                className="mt-4 w-full rounded-xl px-4 py-3 font-bold text-zinc-300 underline underline-offset-4"
              >
                SÓ QUERO OLHAR
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-2xl backdrop-blur-sm sm:p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="hidden text-xs font-bold tracking-[0.24em] text-yellow-400 sm:block">
              GUETTO DELIVERY
            </p>
            <h2 className="cardapio-title text-2xl font-black uppercase sm:mt-1 sm:text-3xl">
              Cardápio
            </h2>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              {atendimentoAberto
                ? somenteRetiradaHoje
                  ? "Catálogo · compras presenciais"
                  : "Aberto agora"
                : "Fechado agora"}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:items-center">
            {!somenteRetiradaHoje && ultimoPedido.length > 0 && (
              <button
                type="button"
                onClick={repetirUltimoPedido}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-yellow-400 px-3 py-2 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/10 sm:flex-none"
                aria-label="Refazer último pedido"
              >
                <RotateCcw size={18} aria-hidden="true" />
                <span>Repetir último pedido</span>
              </button>
            )}
            <details className="relative flex-1 sm:flex-none">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-zinc-600 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-800">
                <MoreHorizontal size={19} aria-hidden="true" /> Mais
              </summary>
              <div className="absolute right-0 top-12 z-40 grid min-w-56 gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">
                {ultimoPedidoId && (
                  <button
                    type="button"
                    onClick={acompanharPedido}
                    className="flex items-center gap-2 rounded-lg px-3 py-3 text-left font-bold text-blue-200 hover:bg-zinc-800"
                  >
                    <Clock3 size={18} /> Acompanhar pedido
                  </button>
                )}
                <Link
                  href="/historico"
                  className="flex items-center gap-2 rounded-lg px-3 py-3 font-bold text-zinc-200 hover:bg-zinc-800"
                >
                  <History size={18} /> Meus pedidos
                </Link>
                <a
                  href="https://wa.me/554491271708?text=Olá!%20Preciso%20de%20ajuda%20com%20meu%20pedido."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-3 font-bold text-green-300 hover:bg-zinc-800"
                >
                  <MessageCircle size={18} /> Pedir ajuda
                </a>
              </div>
            </details>
            {!somenteRetiradaHoje && (
              <button
                onClick={abrirCarrinhoParaPedido}
                className="relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-300 sm:flex-none sm:px-4"
                aria-label="Abrir carrinho"
              >
                <ShoppingBag size={19} /> Carrinho
                {quantidadeTotal > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1 text-xs text-white">
                    {quantidadeTotal}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div className="rounded-xl bg-zinc-900/80 p-3">
              {somenteRetiradaHoje ? (
                <Store className="mb-1 text-yellow-400" size={18} />
              ) : (
                <Truck className="mb-1 text-yellow-400" size={18} />
              )}
              <strong className="block text-white">
                {somenteRetiradaHoje ? "Catálogo para consulta" : "Entrega grátis"}
              </strong>
              <span className="text-zinc-400">
                {somenteRetiradaHoje ? "Veja produtos e preços" : "Sem taxa"}
              </span>
            </div>
            <div className="rounded-xl bg-zinc-900/80 p-3">
              <Clock3 className="mb-1 text-yellow-400" size={18} />
              <strong className="block text-white">
                {somenteRetiradaHoje
                  ? "Compra presencial"
                  : `Até ${tempoEntrega} min`}
              </strong>
              <span className="text-zinc-400">
                {somenteRetiradaHoje ? "Diretamente na loja" : "Após confirmar"}
              </span>
            </div>
            {somenteRetiradaHoje && (
              <a
                href={GOOGLE_EMPRESA_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-blue-500/15 p-3 transition hover:bg-blue-500/25"
                aria-label="Abrir a localização oficial da Guetto no Google"
              >
                <MapPin className="mb-1 text-blue-300" size={18} />
                <strong className="block text-white">Como chegar?</strong>
                <span className="text-blue-200">Abrir no Google</span>
              </a>
            )}
          </div>

          {somenteRetiradaHoje ? (
            <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-sm lg:min-w-80">
              <strong className="flex items-center gap-2 text-yellow-300">
                <Store size={17} /> Somente compras presenciais
              </strong>
              <p className="mt-1 text-zinc-300">
                O site está disponível apenas para consultar produtos e preços.
              </p>
              <a
                href={GOOGLE_EMPRESA_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 font-bold text-blue-200 underline underline-offset-4"
              >
                <MapPin size={16} /> Ver localização oficial
              </a>
            </div>
          ) : (
            <div className="text-sm font-bold text-zinc-200 lg:min-w-[28rem]">
              <span className="mb-1.5 flex items-center gap-2">
                <MapPin size={17} className="text-yellow-400" />
                CIDADE DA ENTREGA
              </span>
              <div className="grid grid-cols-3 gap-2">
                {CIDADES_ENTREGA.map((cidade) => (
                  <button
                    key={cidade.nome}
                    type="button"
                    onClick={() => escolherCidade(cidade.nome)}
                    aria-pressed={cidadeEntrega === cidade.nome}
                    className={`min-h-16 rounded-xl border px-2 py-2 text-center text-xs font-black transition sm:text-sm ${
                      cidadeEntrega === cidade.nome
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-zinc-700 bg-zinc-900 text-white hover:border-yellow-400"
                    }`}
                  >
                    <span className="block">{cidade.nome}</span>
                    <span className="mt-1 block text-[10px] font-bold opacity-75">
                      MÍN. {formatarPreco(cidade.pedidoMinimo)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {somenteRetiradaHoje && (
        <div className="mb-4 rounded-xl border border-yellow-400/50 bg-yellow-400/10 p-4 text-yellow-100">
          <p className="flex items-center gap-2 font-bold">
            <Store size={19} /> Hoje não haverá delivery.
          </p>
          <p className="mt-1 text-sm">
            O cardápio fica disponível para consulta, mas não aceita pedidos.
            Para comprar, venha pessoalmente à loja.
          </p>
        </div>
      )}

      {!atendimentoAberto && (
        <div className="mb-4 rounded-xl border border-red-500/50 bg-red-950/50 p-4 text-red-100">
          <p className="font-bold">A Guetto Delivery está encerrada no momento.</p>
          {horarioConfigurado ? (
            <p className="mt-1 text-sm">Atendimento de hoje: das {horarioAbertura} às {horarioFechamento}.</p>
          ) : (
            <p className="mt-1 text-sm">O horário de atendimento ainda não foi definido.</p>
          )}
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-4 border-y border-white/10 bg-zinc-950/95 px-4 py-3 shadow-xl backdrop-blur sm:-mx-5 sm:px-5">
        <label className="relative block">
          <span className="sr-only">Pesquisar produtos</span>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input
            type="search"
            name="busca-produtos"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Pesquisar produto, marca ou sabor"
            aria-label="Pesquisar produto, marca ou sabor"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-12 pr-4 outline-none focus:border-yellow-400"
          />
        </label>
        <select
          value={busca ? "" : categoriaAtiva ?? ""}
          onChange={(event) => {
            setBusca("");
            setCategoriaAtiva(event.target.value);
          }}
          aria-label="Escolher categoria"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-2.5 font-bold text-white outline-none focus:border-yellow-400 sm:hidden"
        >
          {busca && <option value="">Resultados da busca</option>}
          {produtos.some((produto) => produto.mais_vendido) && (
            <option value="mais-vendidos">🔥 Mais vendidos</option>
          )}
          {produtos.some((produto) => produto.destaque) && (
            <option value="destaques">⭐ Ofertas e destaques</option>
          )}
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.icone} {categoria.nome}
            </option>
          ))}
        </select>
        <div className="mt-2 hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {produtos.some((produto) => produto.mais_vendido) && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setCategoriaAtiva("mais-vendidos");
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition ${
                categoriaAtiva === "mais-vendidos" && !busca
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-700 bg-zinc-900 hover:border-yellow-400"
              }`}
            >
              🔥 Mais vendidos
            </button>
          )}
          {produtos.some((produto) => produto.destaque) && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setCategoriaAtiva("destaques");
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition ${
                categoriaAtiva === "destaques" && !busca
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-700 bg-zinc-900 hover:border-yellow-400"
              }`}
            >
              ⭐ Ofertas e destaques
            </button>
          )}
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              onClick={() => {
                setBusca("");
                setCategoriaAtiva(categoria.id);
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition ${
                categoriaAtiva === categoria.id && !busca
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-zinc-700 bg-zinc-900 hover:border-yellow-400"
              }`}
            >
              {categoria.icone} {categoria.nome}
            </button>
          ))}
        </div>
      </div>

      {categoriaAtiva === "mais-vendidos" && !busca.trim() && (
        <div className="mt-5 rounded-2xl border-2 border-yellow-400 bg-yellow-400/10 p-4 text-center">
          <p className="text-lg font-black text-yellow-300">
            🍻 MAIS ECONOMIA NA CAIXA FECHADA
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Na tela inicial, cervejas aparecem em caixas e packs. Unidades estão
            na categoria Cervejas.
          </p>
        </div>
      )}

      {produtosFiltrados.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700 p-10 text-center text-zinc-400">
          Nenhum produto encontrado nesta categoria.
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {secoesProdutos.map((secao) => (
            <section
              key={secao.id}
              aria-labelledby={secao.titulo ? `secao-${secao.id}` : undefined}
            >
              {secao.titulo && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
                    Tabacaria
                  </p>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2
                        id={`secao-${secao.id}`}
                        className="text-2xl font-black text-white"
                      >
                        {secao.id === "essencias" ? "🌿 " : ""}
                        {secao.titulo}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-300">
                        {secao.descricao}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-950/70 px-3 py-1 text-xs font-bold text-yellow-300">
                      {secao.produtos.length}{" "}
                      {secao.produtos.length === 1 ? "produto" : "produtos"}
                    </span>
                  </div>
                </div>
              )}
              <div
                className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
                  secao.titulo ? "mt-4" : ""
                }`}
              >
          {secao.produtos.map((produto) => {
            const item = carrinho.find((itemCarrinho) => itemCarrinho.id === produto.id);
            const semEstoque = estoqueDisponivel(produto) <= 0;
            const categoriaProduto = categorias.find(
              (categoria) => categoria.id === produto.categoria_id
            )?.nome;
            const eCombo = categoriaProduto === "Combos";
            const eGeloDeSabor = ["gelinho gourmet", "gelo de sabor"].includes(
              produto.nome.trim().toLowerCase()
            );
            const eJackDaniels = produto.nome.trim().toLowerCase() === "whisky jack daniels";
            const produtoEhEssencia = ehEssencia(produto);
            const exigeEscolhaDeSabor =
              eCombo ||
              eGeloDeSabor ||
              eJackDaniels ||
              Boolean(produto.estoque_opcoes);

            return (
              <article
                key={produto.id}
                className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-zinc-900/95 shadow-xl transition ${
                  semEstoque
                    ? "border-zinc-800"
                    : "border-white/10 hover:-translate-y-1 hover:border-yellow-400/60"
                }`}
              >
                <div className="relative aspect-[4/3] bg-white sm:aspect-square">
                  {produto.imagem ? (
                    <Image
                      src={produto.imagem}
                      alt={formatarNomeProduto(produto.nome)}
                      fill
                      className={`object-contain p-4 ${
                        semEstoque ? "grayscale opacity-60" : ""
                      }`}
                      sizes="(max-width: 640px) calc(100vw - 2.5rem), (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-500">
                      Sem imagem
                    </div>
                  )}
                  {produto.mais_vendido ? (
                    <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      🔥 MAIS PEDIDO
                    </span>
                  ) : produto.destaque ? (
                    <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                      Destaque
                    </span>
                  ) : null}
                  {semEstoque && (
                    <span className="absolute right-3 top-3 rounded-full bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-200">
                      Esgotado
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-lg bg-black/85 px-3 py-1.5 text-sm font-black text-white shadow-lg">
                    {rotuloQuantidadeProduto(produto)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <h3 className="line-clamp-2 min-h-12 text-lg font-bold sm:min-h-14 sm:text-xl">
                    {formatarNomeProduto(produto.nome)}
                  </h3>
                  {produtoEhEssencia && produto.estoque_opcoes ? (
                    <div className="mt-2 min-h-10 text-sm text-zinc-400">
                      <span className="font-bold text-zinc-300">
                        Escolha o sabor
                      </span>
                    </div>
                  ) : eGeloDeSabor ? (
                    <p className="mt-2 min-h-10 text-sm font-bold text-zinc-300">
                      Escolha o sabor ao adicionar
                    </p>
                  ) : (
                    produto.descricao && (
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-zinc-400">
                        {produto.descricao}
                      </p>
                    )
                  )}
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div>
                      <p className="price-tag inline-flex rounded-md bg-red-600 px-3 py-1.5 text-xl font-black text-white">
                        {formatarPreco(produto.preco)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {semEstoque
                          ? "Indisponível"
                          : estoqueDisponivel(produto) <= 5
                            ? `Últimas ${estoqueDisponivel(produto)} unidades`
                            : "Disponível"}
                      </p>
                    </div>
                    {semEstoque ? (
                      <span className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-center text-xs font-bold text-zinc-300">
                        Indisponível
                      </span>
                    ) : somenteRetiradaHoje ? (
                      <span className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-center text-xs font-bold text-yellow-200">
                        Venda somente na loja
                      </span>
                    ) : item && !exigeEscolhaDeSabor ? (
                      <div className="flex items-center gap-3 rounded-lg bg-zinc-800 p-1">
                        <button
                          onClick={() => alterarQuantidade(produto, -1)}
                          className="rounded-md p-2 hover:bg-zinc-700"
                          aria-label={`Remover uma unidade de ${produto.nome}`}
                        >
                          <Minus size={18} />
                        </button>
                        <span className="w-5 text-center font-bold">{item.quantidade}</span>
                        <button
                        onClick={() => alterarQuantidade(produto, 1)}
                        disabled={item.quantidade >= estoqueDisponivel(produto)}
                          className="rounded-md p-2 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Adicionar uma unidade de ${produto.nome}`}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          eCombo
                            ? abrirConfiguracaoCombo(produto)
                            : exigeEscolhaDeSabor
                              ? abrirConfiguracaoGelo(produto)
                              : alterarQuantidade(produto, 1)
                        }
                        disabled={semEstoque || !atendimentoAberto}
                        className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                      >
                        {eCombo
                          ? "Montar combo"
                          : exigeEscolhaDeSabor
                            ? "Escolher sabor"
                            : "+ ADICIONAR"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
              </div>
            </section>
          ))}
        </div>
      )}

      {!somenteRetiradaHoje && geloEmConfiguracao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setGeloEmConfiguracao(null)}>
          <div className="w-full max-w-md rounded-2xl border border-yellow-400/50 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-400">
                  {geloEmConfiguracao.nome.toLowerCase().includes("jack daniel")
                    ? "Whisky Jack Daniel’s"
                    : formatarNomeProduto(geloEmConfiguracao.nome)}
                </h2>
                <p className="text-zinc-300">Escolha o sabor e a quantidade.</p>
              </div>
              <button type="button" onClick={() => setGeloEmConfiguracao(null)} className="rounded-lg p-2 hover:bg-zinc-800"><X /></button>
            </div>

            <label className="block text-sm font-bold">
              Sabor
              <select
                value={saborGeloAvulso}
                onChange={(event) => setSaborGeloAvulso(event.target.value)}
                className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal"
              >
                {saboresDoProduto(geloEmConfiguracao).map((sabor) => (
                  <option key={sabor} value={sabor}>
                    {sabor}
                    {geloEmConfiguracao.estoque_opcoes
                      ? ` — ${geloEmConfiguracao.estoque_opcoes[sabor]} em estoque`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            {(detalheSaborSelecionado?.imagem ||
              detalheSaborSelecionado?.descricao) && (
              <div className="mt-4 flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                {detalheSaborSelecionado.imagem && (
                  <Image
                    src={detalheSaborSelecionado.imagem}
                    alt={`${saborGeloAvulso} - ${geloEmConfiguracao.nome}`}
                    width={88}
                    height={88}
                    className="h-[88px] w-[88px] shrink-0 rounded-lg bg-white object-contain p-1"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-yellow-300">
                    {saborGeloAvulso}
                  </p>
                  {detalheSaborSelecionado.descricao && (
                    <p className="mt-1 text-sm text-zinc-300">
                      {detalheSaborSelecionado.descricao}
                    </p>
                  )}
                </div>
              </div>
            )}

            <label className="mt-4 block text-sm font-bold">
              Quantidade
              <input
                type="number"
                min={1}
                max={
                  geloEmConfiguracao.estoque_opcoes?.[saborGeloAvulso] ??
                  estoqueDisponivel(geloEmConfiguracao)
                }
                value={quantidadeGeloAvulso}
                onChange={(event) => setQuantidadeGeloAvulso(Number(event.target.value))}
                className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal"
              />
            </label>

            <button type="button" onClick={confirmarGelo} className="mt-6 w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300">
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      )}

      {!somenteRetiradaHoje && avisoCarrinho && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm text-yellow-100">
          <p>{avisoCarrinho}</p>
          <button
            type="button"
            onClick={() => setAvisoCarrinho("")}
            className="font-bold text-yellow-300"
          >
            Fechar
          </button>
        </div>
      )}

      {!somenteRetiradaHoje && (
      <aside className="fixed bottom-4 right-4 top-28 z-40 hidden w-72 flex-col overflow-hidden rounded-2xl border border-yellow-400/40 bg-zinc-950/95 shadow-2xl backdrop-blur xl:flex">
        <div className="border-b border-zinc-800 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <ShoppingBag size={20} className="text-yellow-400" />
              Seu carrinho
            </h2>
            <span className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-black text-black">
              {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {carrinho.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-zinc-400">
              <div>
                <ShoppingBag className="mx-auto mb-3 text-zinc-600" size={38} />
                <p>Seu carrinho está vazio.</p>
                <p className="mt-1 text-xs">Adicione produtos para ver o total.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {carrinho.map((item) => (
                <div
                  key={`mini-${chaveItem(item)}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
                >
                  <div className="flex justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold">
                      {formatarNomeProduto(item.nome)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setCarrinho((itens) =>
                          itens.filter(
                            (produto) => chaveItem(produto) !== chaveItem(item)
                          )
                        )
                      }
                      className="shrink-0 text-red-400 hover:text-red-300"
                      aria-label={`Remover ${item.nome}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {item.sabor && (
                    <p className="mt-1 text-xs text-zinc-400">Sabor: {item.sabor}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item, -1)}
                        className="rounded p-1 hover:bg-zinc-700"
                        aria-label={`Diminuir ${item.nome}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item, 1)}
                        className="rounded p-1 hover:bg-zinc-700"
                        aria-label={`Aumentar ${item.nome}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-yellow-400">
                      {formatarPreco(calcularSubtotalItem(item))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 bg-black/30 p-5">
          <div className="mb-3">
            <IndicadorPedidoMinimo compacto />
          </div>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-bold">Total</span>
            <span className="text-xl font-black text-yellow-400">
              {formatarPreco(valorTotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={abrirCarrinhoParaPedido}
            disabled={carrinho.length === 0}
            className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            Finalizar pedido
          </button>
        </div>
      </aside>
      )}

      {!somenteRetiradaHoje && comboEmConfiguracao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setComboEmConfiguracao(null)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-yellow-400/50 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-400">Monte seu combo</h2>
                <p className="text-zinc-300">
                  {formatarNomeProduto(comboEmConfiguracao.nome)}
                </p>
              </div>
              <button type="button" onClick={() => setComboEmConfiguracao(null)} className="rounded-lg p-2 hover:bg-zinc-800"><X /></button>
            </div>

            <div className="space-y-4">
              {comboEmConfiguracao.nome.toLowerCase().includes("askov") && (
                <label className="block text-sm font-bold">Sabor da Askov
                  <select value={saborAskov} onChange={(event) => setSaborAskov(event.target.value)} className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal">
                    {saboresAskov.map((sabor) => <option key={sabor} value={sabor}>{sabor}</option>)}
                  </select>
                </label>
              )}

              {comboEmConfiguracao.nome.toLowerCase().includes("gin eternity") && (
                <label className="block text-sm font-bold">Sabor do Gin Eternity
                  <select value={saborGinEternity} onChange={(event) => setSaborGinEternity(event.target.value)} className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal">
                    {saboresGinEternity.map((sabor) => <option key={sabor} value={sabor}>{sabor}</option>)}
                  </select>
                </label>
              )}

              <label className="block text-sm font-bold">Sabor do energético 2 L
                <select value={saborEnergetico} onChange={(event) => setSaborEnergetico(event.target.value)} className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal">
                  {saboresEnergetico.map((sabor) => <option key={sabor} value={sabor}>{sabor}</option>)}
                </select>
              </label>

              {comboEmConfiguracao.nome.toLowerCase().includes("jack daniel") && (
                <label className="block text-sm font-bold">Sabor do Jack Daniel&apos;s
                  <select value={saborWhisky} onChange={(event) => setSaborWhisky(event.target.value)} className="mt-2 w-full rounded-lg bg-zinc-800 p-3 font-normal">
                    {saboresWhiskyJack.map((sabor) => <option key={sabor} value={sabor}>{sabor}</option>)}
                  </select>
                </label>
              )}

              <div>
                <p className="text-sm font-bold">Escolha os 6 gelos</p>
                <label className="mt-2 block text-xs font-semibold text-yellow-300">
                  Atalho: usar o mesmo sabor nos 6 gelos
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        setSaboresGelo(Array(6).fill(event.target.value));
                      }
                    }}
                    className="mt-1 w-full rounded-lg bg-zinc-800 p-2 text-sm font-normal text-white"
                  >
                    <option value="">Escolha um sabor para todos</option>
                    {saboresDeGelo.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {saboresGelo.map((sabor, indice) => (
                    <label key={indice} className="text-xs text-zinc-300">Gelo {indice + 1}
                      <select value={sabor} onChange={(event) => setSaboresGelo((atual) => atual.map((item, posicao) => posicao === indice ? event.target.value : item))} className="mt-1 w-full rounded-lg bg-zinc-800 p-2 text-sm text-white">
                        {saboresDeGelo.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" onClick={confirmarCombo} className="mt-6 w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300">Adicionar combo ao carrinho</button>
          </div>
        </div>
      )}

      {!somenteRetiradaHoje && quantidadeTotal > 0 && !carrinhoAberto && (
        <button
          type="button"
          onClick={abrirCarrinhoParaPedido}
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-yellow-400 px-5 py-4 font-black text-black shadow-2xl hover:bg-yellow-300 xl:hidden"
        >
          <span className="flex flex-col items-start">
            <span className="flex items-center gap-2">
              <ShoppingBag size={20} />
              {quantidadeTotal} {quantidadeTotal === 1 ? "ITEM" : "ITENS"} · CONTINUAR
            </span>
            <span className="text-xs font-semibold">
              {somenteRetiradaHoje
                ? "Somente retirada na loja"
                : pedidoMinimoAtual === null
                  ? "Escolha a cidade para ver o mínimo"
                  : faltaPedidoMinimo === 0
                    ? "PRONTO PARA PEDIR ✓"
                    : `Faltam ${formatarPreco(faltaPedidoMinimo ?? 0)}`}
            </span>
          </span>
          <span>{formatarPreco(valorTotal)}</span>
        </button>
      )}

      {!somenteRetiradaHoje && revisaoAberta && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmacao"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-yellow-400/50 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-yellow-300">
                  Etapa 3 de 3
                </p>
                <h2 id="titulo-confirmacao" className="text-3xl font-black text-yellow-400">CONFIRMAR</h2>
                <p className="text-sm text-zinc-400">Confira e confirme seu pedido.</p>
              </div>
              <button
                type="button"
                onClick={() => setRevisaoAberta(false)}
                className="rounded-lg p-2 hover:bg-zinc-800"
                aria-label="Fechar revisão"
              >
                <X />
              </button>
            </div>

            <ol className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-zinc-900 p-3 text-center text-[10px] font-bold">
              {[
                "ONDE ENTREGAR",
                "COMO PAGAR",
                "CONFIRMAR",
              ].map(
                (etapa, indice) => (
                  <li
                    key={etapa}
                    className={indice < 2 ? "text-yellow-300" : "text-green-300"}
                    aria-current={indice === 2 ? "step" : undefined}
                  >
                    <span
                      className={`mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full ${
                        indice < 2
                          ? "bg-yellow-400 text-black"
                          : "bg-green-500 text-black"
                      }`}
                    >
                      {indice + 1}
                    </span>
                    {etapa}
                  </li>
                )
              )}
            </ol>

            <div className="mt-5 space-y-3">
              {carrinho.map((item) => (
                <div key={chaveItem(item)} className="rounded-xl bg-zinc-900 p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-bold">
                      {item.quantidade}x {formatarNomeProduto(item.nome)}
                    </p>
                    <p className="font-bold text-yellow-400">
                      {formatarPreco(calcularSubtotalItem(item))}
                    </p>
                  </div>
                  {item.sabor && <p className="mt-1 text-sm text-zinc-300">Sabor: {item.sabor}</p>}
                  {item.escolhasCombo && (
                    <p className="mt-1 text-sm text-zinc-300">
                      {item.escolhasCombo.askov ? `Askov ${item.escolhasCombo.askov} · ` : ""}
                      {item.escolhasCombo.whisky && item.nome.toLowerCase().includes("gin eternity")
                        ? `Gin Eternity ${item.escolhasCombo.whisky} · `
                        : ""}
                      Energético {item.escolhasCombo.energetico} · 6 gelos
                      {item.escolhasCombo.whisky && item.nome.toLowerCase().includes("jack daniel")
                        ? ` · Jack Daniel’s ${item.escolhasCombo.whisky}`
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300">
              <p className="font-bold text-white">{nomeCompleto.trim()}</p>
              <p>{telefone.trim()}</p>
              {somenteRetiradaHoje ? (
                <p className="font-bold text-yellow-300">Retirada na loja</p>
              ) : (
                <>
                  <p>{endereco.trim()} — {bairro.trim()} — {cidadeEntrega}</p>
                  {referencia.trim() && <p>Referência: {referencia.trim()}</p>}
                </>
              )}
            </div>

            <div className="mt-5 rounded-xl border-2 border-yellow-400 bg-yellow-400/10 p-4">
              <p className="text-sm font-black uppercase tracking-wide text-yellow-300">
                Forma de pagamento
              </p>
              {[
                primeiroPagamento,
                segundoPagamento,
                terceiroPagamento,
              ]
                .slice(0, quantidadePagamentos)
                .map((pagamento, indice) => (
                <p key={`${pagamento.forma}-${indice}`} className="mt-1 text-lg font-black text-white">
                  {resumoPagamento(
                    pagamento,
                    quantidadePagamentos > 1
                      ? valorNumerico(pagamento.valor)
                      : valorTotal
                  )}
                </p>
                ))}
            </div>

            <div className="mt-5 flex items-center justify-between text-xl font-black">
              <span>Total</span>
              <span className="text-yellow-400">{formatarPreco(valorTotal)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMaiorDeIdadeConfirmado((confirmado) => !confirmado);
                setErroRevisao("");
              }}
              aria-pressed={maiorDeIdadeConfirmado}
              className={`mt-5 flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl border-2 px-4 py-4 text-lg font-black transition ${
                maiorDeIdadeConfirmado
                  ? "border-green-400 bg-green-500 text-black"
                  : "border-red-500 bg-red-950/50 text-white"
              }`}
            >
              {maiorDeIdadeConfirmado && <Check size={26} />}
              TENHO 18 ANOS OU MAIS
            </button>
            <p className="mt-2 text-center text-xs text-red-200">
              Proibida a venda de bebidas e tabacaria para menores de 18 anos.
            </p>

            <button
              type="button"
              onClick={() => {
                const salvar = !salvarDadosNoAparelho;
                setSalvarDadosNoAparelho(salvar);
                if (!salvar) {
                  window.localStorage.removeItem("guetto_dados_cliente");
                  setDadosClienteRecuperados(false);
                }
              }}
              aria-pressed={salvarDadosNoAparelho}
              className="mt-4 flex w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${
                  salvarDadosNoAparelho
                    ? "border-yellow-400 bg-yellow-400 text-black"
                    : "border-zinc-500"
                }`}
              >
                {salvarDadosNoAparelho && <Check size={18} />}
              </span>
              <span>
                <strong className="block text-white">
                  SALVAR MEU ENDEREÇO
                </strong>
                <span className="text-xs text-zinc-400">
                  Para o próximo pedido neste aparelho.
                </span>
              </span>
            </button>

            {erroRevisao && (
              <div
                className="mt-4 rounded-xl border-2 border-red-500 bg-red-950 p-4 text-center font-black text-red-100"
                role="alert"
              >
                {erroRevisao}
              </div>
            )}
            <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-green-500 bg-green-500/10 p-4 text-sm text-green-100">
              <MessageCircle className="mt-0.5 shrink-0 text-green-400" size={22} />
              <p>
                <strong className="block text-base text-white">
                  ENVIO PELO WHATSAPP É OBRIGATÓRIO
                </strong>
                Depois de confirmar, o WhatsApp abrirá. Toque no botão de
                enviar para concluir o pedido.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setRevisaoAberta(false);
                  setEtapaCheckout(2);
                  setCarrinhoAberto(true);
                }}
                className="rounded-xl border border-zinc-700 px-4 py-3 font-bold hover:bg-zinc-900"
              >
                Voltar ao pagamento
              </button>
              <button
                type="button"
                onClick={() => finalizarPedido(true)}
                disabled={enviandoPedido || !maiorDeIdadeConfirmado}
                className="rounded-xl bg-green-500 px-4 py-3 font-bold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {enviandoPedido
                  ? "ABRINDO WHATSAPP..."
                  : maiorDeIdadeConfirmado
                    ? "CONFIRMAR E ENVIAR NO WHATSAPP"
                    : "CONFIRME SUA IDADE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pedidoConfirmado && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-pedido-confirmado"
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-green-400 bg-zinc-950 p-6 text-center shadow-2xl sm:p-8">
            <CheckCircle2 className="mx-auto text-green-400" size={68} />
            <h2
              id="titulo-pedido-confirmado"
              className="mt-4 text-3xl font-black text-white"
            >
              FALTA ENVIAR NO WHATSAPP
            </h2>
            <p className="mt-2 text-lg font-bold text-yellow-300">
              O pedido foi registrado no site.
            </p>
            <p className="mt-4 rounded-xl border-2 border-green-500 bg-green-500/15 p-4 font-black text-green-200">
              ABRA O WHATSAPP E TOQUE EM ENVIAR PARA CONCLUIR.
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Pedido nº {pedidoConfirmado.id.slice(0, 8).toUpperCase()}
            </p>
            <div className="mt-5 grid gap-3">
              <a
                href={pedidoConfirmado.linkWhatsApp}
                className="rounded-xl bg-green-500 px-4 py-4 text-lg font-black text-black hover:bg-green-400"
              >
                ENVIAR PEDIDO NO WHATSAPP
              </a>
              <a
                href={pedidoConfirmado.linkAcompanhamento}
                className="rounded-xl border border-yellow-400 px-4 py-3 font-bold text-yellow-300 hover:bg-yellow-400/10"
              >
                ACOMPANHAR PEDIDO
              </a>
              <button
                type="button"
                onClick={() => setPedidoConfirmado(null)}
                className="rounded-xl px-4 py-3 font-bold text-zinc-300 underline underline-offset-4"
              >
                CONTINUAR NO CARDÁPIO
              </button>
            </div>
          </div>
        </div>
      )}

      {!somenteRetiradaHoje && carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={() => setCarrinhoAberto(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col bg-zinc-950 p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-checkout"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-yellow-300">
                  Etapa {etapaCheckout} de 3
                </p>
                <h2 id="titulo-checkout" className="text-2xl font-bold">
                  {etapaCheckout === 1 ? "ONDE ENTREGAR" : "COMO PAGAR"}
                </h2>
              </div>
              <button onClick={() => setCarrinhoAberto(false)} className="rounded-lg p-2 hover:bg-zinc-800" aria-label="Fechar carrinho">
                <X />
              </button>
            </div>
            <ol className="grid grid-cols-3 gap-2 border-b border-zinc-800 py-3 text-center text-[10px] font-bold text-zinc-500">
              {[
                "ONDE ENTREGAR",
                "COMO PAGAR",
                "CONFIRMAR",
              ].map(
                (etapa, indice) => (
                  <li
                    key={etapa}
                    className={indice + 1 <= etapaCheckout ? "text-yellow-300" : ""}
                    aria-current={indice + 1 === etapaCheckout ? "step" : undefined}
                  >
                    <span
                      className={`mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full ${
                        indice + 1 <= etapaCheckout
                          ? "bg-yellow-400 text-black"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {indice + 1}
                    </span>
                    {etapa}
                  </li>
                )
              )}
            </ol>
            <div ref={conteudoCheckoutRef} className="flex-1 overflow-y-auto py-5">
              {etapaCheckout === 1 && (carrinho.length === 0 ? (
                <p className="text-center text-zinc-400">Seu carrinho está vazio.</p>
              ) : (
                <details className="rounded-xl border border-zinc-800 bg-zinc-900/70">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-zinc-200">
                    Ver {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"} do pedido · {formatarPreco(valorTotal)}
                  </summary>
                  <div className="space-y-3 border-t border-zinc-800 p-3">
                  {carrinho.map((item) => (
                    <div key={chaveItem(item)} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {item.imagem ? <Image src={item.imagem} alt="" fill className="object-contain p-1" sizes="64px" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{formatarNomeProduto(item.nome)}</p>
                        {item.sabor && <p className="text-xs text-zinc-300">Sabor: {item.sabor}</p>}
                        <p className="text-sm text-yellow-400">{formatarPreco(item.preco)}</p>
                        {item.escolhasCombo && <p className="mt-1 text-xs text-zinc-400">{item.escolhasCombo.askov ? `Askov: ${item.escolhasCombo.askov} · ` : ""}{item.escolhasCombo.whisky && item.nome.toLowerCase().includes("gin eternity") ? `Gin Eternity: ${item.escolhasCombo.whisky} · ` : ""}Energético: {item.escolhasCombo.energetico} · 6 gelos{item.escolhasCombo.whisky && item.nome.toLowerCase().includes("jack daniel") ? ` · Jack Daniel’s: ${item.escolhasCombo.whisky}` : ""}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => alterarQuantidade(item, -1)} className="p-1 text-zinc-300"><Minus size={16} /></button>
                        <span className="w-5 text-center">{item.quantidade}</span>
                        <button onClick={() => alterarQuantidade(item, 1)} className="p-1 text-zinc-300"><Plus size={16} /></button>
                        <button onClick={() => setCarrinho((itens) => itens.filter((produto) => chaveItem(produto) !== chaveItem(item)))} className="ml-1 p-1 text-red-400" aria-label={`Remover ${item.nome}`}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  </div>
                </details>
              ))}

              {carrinho.length > 0 && (
                <div className="mt-7 space-y-4 border-t border-zinc-800 pt-6">
                  {etapaCheckout === 1 && (
                    <>
                  <IndicadorPedidoMinimo />
                  {quantidadeGarrafas300 > 0 && (
                    <div className="rounded-xl border border-yellow-400/50 bg-yellow-400/10 p-4 text-sm">
                      <p className="font-bold text-yellow-300">Garrafinhas de 300 ml</p>
                      <p className="mt-1 text-zinc-200">Pedido mínimo: 10 unidades. O vasilhame é obrigatório, não está incluso e a loja não empresta.</p>
                      <label className="mt-3 flex items-start gap-2 font-semibold">
                        <input type="checkbox" checked={vasilhameConfirmado} onChange={(event) => setVasilhameConfirmado(event.target.checked)} className="mt-1" />
                        Confirmo que vou levar o vasilhame.
                      </label>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow-400 font-black text-black">
                      1
                    </span>
                    <div>
                      <h3 className="font-black text-white">
                        ONDE ENTREGAR
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Preencha os dados abaixo
                      </p>
                    </div>
                  </div>
                  {dadosClienteRecuperados && (
                    <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
                      {somenteRetiradaHoje
                        ? "Preenchemos seus dados salvos neste aparelho."
                        : "Preenchemos seu último endereço. Você pode editar qualquer campo antes de finalizar."}
                    </div>
                  )}
                  {errosCheckout.geral && (
                    <div
                      className="rounded-xl border-2 border-red-500 bg-red-950 p-4 text-center font-black text-red-100"
                      role="alert"
                    >
                      {errosCheckout.geral}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-yellow-400/50 bg-yellow-400/10 p-4">
                    <div>
                      <span className="text-xs font-bold text-zinc-400">ENTREGA EM</span>
                      <strong className="block text-lg text-yellow-300">
                        {cidadeEntrega}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAbrirCheckoutAposCidade(false);
                        setSeletorCidadeAberto(true);
                      }}
                      className="rounded-lg border border-yellow-400 px-3 py-2 text-sm font-black text-yellow-300"
                    >
                      TROCAR
                    </button>
                  </div>
                  <label className="space-y-1.5 text-sm font-bold text-zinc-200">
                    <span>NOME COMPLETO <span aria-hidden="true">*</span></span>
                    <input
                      name="nome-completo"
                      autoComplete="name"
                      value={nomeCompleto}
                      onChange={(event) => {
                        setNomeCompleto(event.target.value);
                        setErrosCheckout((erros) => ({ ...erros, nomeCompleto: undefined }));
                      }}
                      placeholder="Ex.: Maria Silva"
                      aria-invalid={Boolean(errosCheckout.nomeCompleto)}
                      required
                      className={`w-full min-w-0 rounded-xl border-2 bg-zinc-900 p-4 text-lg font-normal text-white outline-none focus:border-yellow-400 ${
                        errosCheckout.nomeCompleto ? "border-red-500" : "border-transparent"
                      }`}
                    />
                    {errosCheckout.nomeCompleto && (
                      <span className="block font-black text-red-400" role="alert">
                        {errosCheckout.nomeCompleto}
                      </span>
                    )}
                  </label>
                  <label className="space-y-1.5 text-sm font-bold text-zinc-200">
                    <span>SEU WHATSAPP COM DDD <span aria-hidden="true">*</span></span>
                    <input
                      name="telefone"
                      autoComplete="tel"
                      value={telefone}
                      onChange={(event) => {
                        setTelefone(event.target.value);
                        setErrosCheckout((erros) => ({ ...erros, telefone: undefined }));
                      }}
                      inputMode="tel"
                      placeholder="Ex.: (44) 99999-9999"
                      aria-describedby={
                        errosCheckout.telefone
                          ? "erro-telefone"
                          : "ajuda-telefone"
                      }
                      aria-invalid={Boolean(errosCheckout.telefone)}
                      required
                      className={`w-full rounded-xl border-2 bg-zinc-900 p-4 text-lg font-normal text-white outline-none focus:border-yellow-400 ${
                        errosCheckout.telefone ? "border-red-500" : "border-transparent"
                      }`}
                    />
                    {errosCheckout.telefone ? (
                      <span id="erro-telefone" className="block font-black text-red-400" role="alert">
                        {errosCheckout.telefone}
                      </span>
                    ) : (
                      <span id="ajuda-telefone" className="block text-xs font-normal text-zinc-400">
                        A loja usa este número para falar com você.
                      </span>
                    )}
                  </label>
                  {somenteRetiradaHoje ? (
                    <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                      <strong>Pedido para retirada na loja</strong>
                      <p className="mt-1 text-zinc-300">
                        Não é necessário informar endereço. Avisaremos pelo
                        WhatsApp quando estiver pronto.
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="space-y-1.5 text-sm font-bold text-zinc-200">
                        <span>RUA E NÚMERO <span aria-hidden="true">*</span></span>
                        <input
                          name="endereco"
                          autoComplete="street-address"
                          value={endereco}
                          onChange={(event) => {
                            setEndereco(event.target.value);
                            setErrosCheckout((erros) => ({ ...erros, endereco: undefined }));
                          }}
                          placeholder="Ex.: Rua das Flores, 123"
                          aria-invalid={Boolean(errosCheckout.endereco)}
                          required
                          className={`w-full rounded-xl border-2 bg-zinc-900 p-4 text-lg font-normal text-white outline-none focus:border-yellow-400 ${
                            errosCheckout.endereco ? "border-red-500" : "border-transparent"
                          }`}
                        />
                        {errosCheckout.endereco && (
                          <span className="block font-black text-red-400" role="alert">
                            {errosCheckout.endereco}
                          </span>
                        )}
                      </label>
                      <label className="space-y-1.5 text-sm font-bold text-zinc-200">
                        <span>BAIRRO <span aria-hidden="true">*</span></span>
                        <select
                          name="bairro"
                          autoComplete="address-level3"
                          value={bairro}
                          onChange={(event) => {
                            setBairro(event.target.value);
                            setErrosCheckout((erros) => ({ ...erros, bairro: undefined }));
                          }}
                          required
                          aria-invalid={Boolean(errosCheckout.bairro)}
                          className={`w-full rounded-xl border-2 bg-zinc-900 p-4 text-lg font-normal text-white outline-none focus:border-yellow-400 ${
                            errosCheckout.bairro ? "border-red-500" : "border-transparent"
                          }`}
                        >
                          <option value="">Escolha o bairro</option>
                          {bairrosDaCidade(cidadeEntrega).map((opcao) => (
                            <option key={opcao} value={opcao}>
                              {opcao}
                            </option>
                          ))}
                        </select>
                        {errosCheckout.bairro && (
                          <span className="block font-black text-red-400" role="alert">
                            {errosCheckout.bairro}
                          </span>
                        )}
                      </label>
                      <label className="space-y-1.5 text-sm font-bold text-zinc-200">
                        <span>Ponto de referência <span className="font-normal text-zinc-400">(opcional)</span></span>
                        <input
                          name="referencia"
                          value={referencia}
                          onChange={(event) => setReferencia(event.target.value)}
                          placeholder="Ex.: perto da praça"
                          className="w-full rounded-lg bg-zinc-900 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2"
                        />
                      </label>
                    </>
                  )}
                    </>
                  )}

                  {etapaCheckout === 2 && (
                    <div id="escolha-pagamento" className="space-y-4">
                      <div className="flex items-center gap-3 rounded-xl border-2 border-yellow-400 bg-yellow-400/10 p-4">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yellow-400 font-black text-black">
                          2
                        </span>
                        <div>
                          <h3 className="text-xl font-black text-yellow-300">
                            COMO VAI PAGAR?
                          </h3>
                          <p className="text-sm text-zinc-300">Toque em uma opção.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPrimeiroPagamento({ ...pagamentoVazio, forma: "pix" });
                            setCartaoEmEscolha(false);
                            setErroPagamento("");
                          }}
                          aria-pressed={primeiroPagamento.forma === "pix"}
                          className={`min-h-24 rounded-2xl border-2 px-2 py-3 font-black ${
                            primeiroPagamento.forma === "pix"
                              ? "border-green-400 bg-green-500 text-black"
                              : "border-zinc-700 bg-zinc-900 text-white"
                          }`}
                        >
                          <QrCode className="mx-auto mb-2" size={28} /> PIX
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPrimeiroPagamento({ ...pagamentoVazio, forma: "dinheiro" });
                            setCartaoEmEscolha(false);
                            setErroPagamento("");
                          }}
                          aria-pressed={primeiroPagamento.forma === "dinheiro"}
                          className={`min-h-24 rounded-2xl border-2 px-2 py-3 font-black ${
                            primeiroPagamento.forma === "dinheiro"
                              ? "border-green-400 bg-green-500 text-black"
                              : "border-zinc-700 bg-zinc-900 text-white"
                          }`}
                        >
                          <Banknote className="mx-auto mb-2" size={28} /> DINHEIRO
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCartaoEmEscolha(true);
                            if (!["credito", "debito"].includes(primeiroPagamento.forma)) {
                              setPrimeiroPagamento(pagamentoVazio);
                            }
                            setErroPagamento("");
                          }}
                          aria-pressed={cartaoEmEscolha || ["credito", "debito"].includes(primeiroPagamento.forma)}
                          className={`min-h-24 rounded-2xl border-2 px-2 py-3 font-black ${
                            cartaoEmEscolha || ["credito", "debito"].includes(primeiroPagamento.forma)
                              ? "border-green-400 bg-green-500 text-black"
                              : "border-zinc-700 bg-zinc-900 text-white"
                          }`}
                        >
                          <CreditCard className="mx-auto mb-2" size={28} /> CARTÃO
                        </button>
                      </div>

                      {(cartaoEmEscolha || ["credito", "debito"].includes(primeiroPagamento.forma)) && (
                        <div className="rounded-xl border border-green-400/50 bg-green-500/10 p-3">
                          <p className="mb-3 text-center font-black text-white">
                            QUAL CARTÃO?
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              ["credito", "CRÉDITO"],
                              ["debito", "DÉBITO"],
                            ] as const).map(([valor, rotulo]) => (
                              <button
                                key={valor}
                                type="button"
                                onClick={() => {
                                  setPrimeiroPagamento({ ...pagamentoVazio, forma: valor });
                                  setCartaoEmEscolha(true);
                                  setErroPagamento("");
                                }}
                                className={`rounded-xl border-2 px-3 py-4 font-black ${
                                  primeiroPagamento.forma === valor
                                    ? "border-yellow-400 bg-yellow-400 text-black"
                                    : "border-zinc-600 bg-zinc-900 text-white"
                                }`}
                              >
                                {rotulo}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!dividirPagamentoAberto && primeiroPagamento.forma === "dinheiro" && (
                        <div className="rounded-xl border-2 border-yellow-400 bg-yellow-400/10 p-4">
                          <p className="text-center text-lg font-black text-yellow-200">
                            PRECISA DE TROCO?
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setPrimeiroPagamento({ ...primeiroPagamento, precisaTroco: false, trocoPara: "" });
                                setErroPagamento("");
                              }}
                              className={`rounded-xl border-2 px-3 py-4 font-black ${
                                primeiroPagamento.precisaTroco === false
                                  ? "border-green-400 bg-green-500 text-black"
                                  : "border-zinc-600 bg-zinc-900 text-white"
                              }`}
                            >
                              NÃO
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPrimeiroPagamento({ ...primeiroPagamento, precisaTroco: true });
                                setErroPagamento("");
                              }}
                              className={`rounded-xl border-2 px-3 py-4 font-black ${
                                primeiroPagamento.precisaTroco === true
                                  ? "border-green-400 bg-green-500 text-black"
                                  : "border-zinc-600 bg-zinc-900 text-white"
                              }`}
                            >
                              SIM
                            </button>
                          </div>
                          {primeiroPagamento.precisaTroco && (
                            <label className="mt-4 block font-bold text-white">
                              TROCO PARA QUANTO?
                              <input
                                name="troco-primeiro-pagamento"
                                value={primeiroPagamento.trocoPara}
                                onChange={(event) => {
                                  setPrimeiroPagamento({ ...primeiroPagamento, trocoPara: event.target.value });
                                  setErroPagamento("");
                                }}
                                inputMode="decimal"
                                placeholder="Ex.: 100,00"
                                className="mt-2 w-full rounded-xl border-2 border-zinc-700 bg-zinc-900 p-4 text-lg font-normal outline-none focus:border-yellow-400"
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {erroPagamento && (
                        <div className="rounded-xl border-2 border-red-500 bg-red-950 p-4 text-center font-black text-red-100" role="alert">
                          {erroPagamento}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const abrir = !dividirPagamentoAberto;
                          setDividirPagamentoAberto(abrir);
                          setQuantidadePagamentos(abrir ? 2 : 1);
                          if (!abrir) {
                            setSegundoPagamento(pagamentoVazio);
                            setTerceiroPagamento(pagamentoVazio);
                          }
                          setErroPagamento("");
                        }}
                        className="w-full rounded-xl px-4 py-3 text-sm font-bold text-zinc-300 underline underline-offset-4"
                      >
                        {dividirPagamentoAberto
                          ? "NÃO QUERO DIVIDIR O PAGAMENTO"
                          : "PRECISA DIVIDIR O PAGAMENTO?"}
                      </button>
                    </div>
                  )}

                  {etapaCheckout === 2 && dividirPagamentoAberto && (
                    <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-yellow-400 bg-yellow-400/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow-400 font-black text-black">
                        2
                      </span>
                      <div>
                        <h3 className="font-black text-yellow-300">DIVIDIR PAGAMENTO</h3>
                        <p className="text-xs text-zinc-300">
                          Informe o valor de cada forma
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-bold text-white">
                      Quantas formas?
                      <select
                        name="quantidade-pagamentos"
                        value={quantidadePagamentos}
                        onChange={(event) =>
                          setQuantidadePagamentos(
                            Number(event.target.value) as QuantidadePagamentos
                          )
                        }
                        className="rounded-lg bg-zinc-800 px-3 py-2 outline-none ring-yellow-400 focus:ring-2"
                      >
                        <option value={2}>2 formas</option>
                        <option value={3}>3 formas</option>
                      </select>
                    </label>
                  </div>

                  <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
                    <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                      <span>{quantidadePagamentos > 1 ? "Forma do 1º pagamento" : "Forma de pagamento"}</span>
                      <select name="primeiro-pagamento" value={primeiroPagamento.forma} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, forma: event.target.value as FormaPagamento | "", precisaTroco: null, trocoPara: "" })} className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2">
                        <option value="">Selecione como deseja pagar</option>
                        {formasPagamento.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
                      </select>
                    </label>
                    {quantidadePagamentos > 1 && (
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Valor do 1º pagamento</span>
                        <input name="valor-primeiro-pagamento" value={primeiroPagamento.valor} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, valor: event.target.value })} inputMode="decimal" placeholder="Ex.: 20,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                      </label>
                    )}
                    {primeiroPagamento.forma === "dinheiro" && (
                      <fieldset className="space-y-2 rounded-lg border border-yellow-400/60 bg-yellow-400/5 p-3" aria-required="true">
                        <legend className="px-1 text-sm font-bold text-yellow-200">
                          Vai precisar de troco? <span className="text-xs text-yellow-400">(obrigatório)</span>
                        </legend>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="radio" name="troco-primeiro-pagamento" value="sim" checked={primeiroPagamento.precisaTroco === true} onChange={() => setPrimeiroPagamento({ ...primeiroPagamento, precisaTroco: true })} required />
                            Sim, preciso de troco
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="radio" name="troco-primeiro-pagamento" value="nao" checked={primeiroPagamento.precisaTroco === false} onChange={() => setPrimeiroPagamento({ ...primeiroPagamento, precisaTroco: false, trocoPara: "" })} required />
                            Não preciso de troco
                          </label>
                        </div>
                      </fieldset>
                    )}
                    {primeiroPagamento.forma === "dinheiro" && primeiroPagamento.precisaTroco && (
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Troco para quanto?</span>
                        <input name="troco-primeiro-pagamento" value={primeiroPagamento.trocoPara} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, trocoPara: event.target.value })} inputMode="decimal" placeholder="Ex.: 100,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                      </label>
                    )}
                  </div>

                  {quantidadePagamentos >= 2 && (
                    <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Forma do 2º pagamento</span>
                        <select name="segundo-pagamento" value={segundoPagamento.forma} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, forma: event.target.value as FormaPagamento | "", precisaTroco: null, trocoPara: "" })} className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2">
                          <option value="">Selecione como deseja pagar</option>
                          {formasPagamento.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Valor do 2º pagamento</span>
                        <input name="valor-segundo-pagamento" value={segundoPagamento.valor} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, valor: event.target.value })} inputMode="decimal" placeholder="Ex.: 20,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                      </label>
                      {segundoPagamento.forma === "dinheiro" && (
                        <fieldset className="space-y-2 rounded-lg border border-yellow-400/60 bg-yellow-400/5 p-3" aria-required="true">
                          <legend className="px-1 text-sm font-bold text-yellow-200">Vai precisar de troco? <span className="text-xs text-yellow-400">(obrigatório)</span></legend>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="troco-segundo-pagamento" value="sim" checked={segundoPagamento.precisaTroco === true} onChange={() => setSegundoPagamento({ ...segundoPagamento, precisaTroco: true })} required /> Sim, preciso de troco</label>
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="troco-segundo-pagamento" value="nao" checked={segundoPagamento.precisaTroco === false} onChange={() => setSegundoPagamento({ ...segundoPagamento, precisaTroco: false, trocoPara: "" })} required /> Não preciso de troco</label>
                          </div>
                        </fieldset>
                      )}
                      {segundoPagamento.forma === "dinheiro" && segundoPagamento.precisaTroco && (
                        <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                          <span>Troco para quanto?</span>
                          <input name="troco-segundo-pagamento" value={segundoPagamento.trocoPara} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, trocoPara: event.target.value })} inputMode="decimal" placeholder="Ex.: 100,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                        </label>
                      )}
                    </div>
                  )}

                  {quantidadePagamentos === 3 && (
                    <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Forma do 3º pagamento</span>
                        <select name="terceiro-pagamento" value={terceiroPagamento.forma} onChange={(event) => setTerceiroPagamento({ ...terceiroPagamento, forma: event.target.value as FormaPagamento | "", precisaTroco: null, trocoPara: "" })} className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2">
                          <option value="">Selecione como deseja pagar</option>
                          {formasPagamento.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                        <span>Valor do 3º pagamento</span>
                        <input name="valor-terceiro-pagamento" value={terceiroPagamento.valor} onChange={(event) => setTerceiroPagamento({ ...terceiroPagamento, valor: event.target.value })} inputMode="decimal" placeholder="Ex.: 20,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                      </label>
                      {terceiroPagamento.forma === "dinheiro" && (
                        <fieldset className="space-y-2 rounded-lg border border-yellow-400/60 bg-yellow-400/5 p-3" aria-required="true">
                          <legend className="px-1 text-sm font-bold text-yellow-200">Vai precisar de troco? <span className="text-xs text-yellow-400">(obrigatório)</span></legend>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="troco-terceiro-pagamento" value="sim" checked={terceiroPagamento.precisaTroco === true} onChange={() => setTerceiroPagamento({ ...terceiroPagamento, precisaTroco: true })} required /> Sim, preciso de troco</label>
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="troco-terceiro-pagamento" value="nao" checked={terceiroPagamento.precisaTroco === false} onChange={() => setTerceiroPagamento({ ...terceiroPagamento, precisaTroco: false, trocoPara: "" })} required /> Não preciso de troco</label>
                          </div>
                        </fieldset>
                      )}
                      {terceiroPagamento.forma === "dinheiro" && terceiroPagamento.precisaTroco && (
                        <label className="block space-y-1.5 text-sm font-semibold text-zinc-300">
                          <span>Troco para quanto?</span>
                          <input name="troco-terceiro-pagamento" value={terceiroPagamento.trocoPara} onChange={(event) => setTerceiroPagamento({ ...terceiroPagamento, trocoPara: event.target.value })} inputMode="decimal" placeholder="Ex.: 100,00" className="w-full rounded-lg bg-zinc-800 p-3 font-normal text-white outline-none ring-yellow-400 focus:ring-2" />
                        </label>
                      )}
                    </div>
                  )}

                  {quantidadePagamentos > 1 && (
                    <div
                      className={`rounded-xl border-2 p-4 ${
                        valorExcedentePagamento > 0.009
                          ? "border-red-500 bg-red-950/50 text-red-100"
                          : valorRestantePagamento > 0.009
                            ? "border-yellow-400 bg-yellow-400/10 text-yellow-100"
                            : "border-green-500 bg-green-950/50 text-green-100"
                      }`}
                    >
                      <p className="text-sm font-bold">
                        Valores informados:{" "}
                        {formatarPreco(totalPagamentosInformado)}
                      </p>
                      <p className="mt-1 text-lg font-black">
                        {valorExcedentePagamento > 0.009
                          ? `Ultrapassou o total em ${formatarPreco(valorExcedentePagamento)}`
                          : valorRestantePagamento > 0.009
                            ? `Falta pagar ${formatarPreco(valorRestantePagamento)}`
                            : "Pagamento completo"}
                      </p>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-zinc-800 pt-5">
              <div className="mb-4 flex justify-between text-lg font-bold"><span>Total</span><span className="text-yellow-400">{formatarPreco(valorTotal)}</span></div>
              {etapaCheckout === 1 ? (
                <button
                  type="button"
                  onClick={avancarParaPagamento}
                  disabled={carrinho.length === 0 || !atendimentoAberto}
                  className="w-full rounded-xl bg-yellow-400 px-4 py-4 text-lg font-black text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  CONTINUAR
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => mudarEtapaCheckout(1)}
                    className="rounded-lg border border-zinc-700 px-4 py-3 font-bold text-white hover:bg-zinc-900"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void finalizarPedido()}
                    disabled={carrinho.length === 0 || !atendimentoAberto}
                    className="rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    CONTINUAR
                  </button>
                </div>
              )}
              <p className="mt-2 text-center text-xs text-zinc-400">
                {etapaCheckout === 1
                  ? "Próximo: escolher o pagamento."
                  : "Próximo: confirmar o pedido."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
