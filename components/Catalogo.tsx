"use client";

import Image from "next/image";
import { ShoppingBag, Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  estoque_opcoes?: Record<string, number> | null;
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

type Pagamento = {
  forma: FormaPagamento | "";
  valor: string;
  precisaTroco: boolean;
  trocoPara: string;
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
  precisaTroco: false,
  trocoPara: "",
};

const WHATSAPP_GUETTO = "554491271708";

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

export default function Catalogo({
  categorias,
  produtos,
  tempoEntrega,
  horarioAbertura,
  horarioFechamento,
}: {
  categorias: Categoria[];
  produtos: Produto[];
  tempoEntrega: number;
  horarioAbertura: string;
  horarioFechamento: string;
}) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [rua, setRua] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [cidadeEntrega, setCidadeEntrega] = useState<"" | "Paranacity" | "Cruzeiro do Sul">("");
  const [pagamentoDividido, setPagamentoDividido] = useState(false);
  const [primeiroPagamento, setPrimeiroPagamento] = useState<Pagamento>(pagamentoVazio);
  const [segundoPagamento, setSegundoPagamento] = useState<Pagamento>(pagamentoVazio);
  const [vasilhameConfirmado, setVasilhameConfirmado] = useState(false);
  const [comboEmConfiguracao, setComboEmConfiguracao] = useState<Produto | null>(null);
  const [saborAskov, setSaborAskov] = useState("");
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

  function estoqueDisponivel(produto: Produto) {
    if (produto.grupo_estoque && typeof produto.estoque_unidades === "number") {
      return Math.floor(produto.estoque_unidades / (produto.unidades_por_venda || 1));
    }
    return produto.estoque;
  }

  const produtosFiltrados = useMemo(
    () => {
      const disponiveis = produtos.filter((produto) => estoqueDisponivel(produto) > 0);
      return categoriaAtiva
        ? disponiveis.filter((produto) => produto.categoria_id === categoriaAtiva)
        : disponiveis;
    },
    [categoriaAtiva, produtos]
  );

  const quantidadeTotal = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0
  );
  const valorTotal = carrinho.reduce(
    (total, item) => total + item.preco * item.quantidade,
    0
  );
  const quantidadeGarrafas300 = carrinho
    .filter((item) => item.nome.toLowerCase().includes("garrafa 300ml"))
    .reduce((total, item) => total + item.quantidade, 0);

  const saboresAskov = produtos
    .filter((produto) => produto.nome.startsWith("Askov 1L - "))
    .map((produto) => produto.nome.replace("Askov 1L - ", ""));
  const saboresEnergetico = produtos
    .filter(
      (produto) =>
        produto.nome.startsWith("Furioso 2L - ") &&
        estoqueDisponivel(produto) > 0
    )
    .map((produto) => produto.nome.replace("Furioso 2L - ", ""));
  const saboresDeGelo = ["Laranja", "Maca Verde", "Limao", "Morango", "Coco", "Maracuja", "Melancia", "Uva Verde", "Amora", "Abacaxi", "Sal e Limao"];
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

  function chaveItem(item: Produto & { sabor?: string; escolhasCombo?: EscolhasCombo }) {
    return `${item.id}:${item.sabor ?? ""}:${item.escolhasCombo ? JSON.stringify(item.escolhasCombo) : ""}`;
  }

  function alterarQuantidade(produto: Produto & { sabor?: string; escolhasCombo?: EscolhasCombo }, alteracao: number) {
    setCarrinho((itens) => {
      const chave = chaveItem(produto);
      const itemAtual = itens.find((item) => chaveItem(item) === chave);
      const estoqueMaximo = produto.sabor
        ? produto.estoque_opcoes?.[produto.sabor] ?? estoqueDisponivel(produto)
        : estoqueDisponivel(produto);

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
                estoqueDisponivel(geloEmConfiguracao),
                item.quantidade + quantidade
              ),
            }
          : item
      );
    });
    setGeloEmConfiguracao(null);
  }

  function abrirConfiguracaoCombo(produto: Produto) {
    setSaborAskov(saboresAskov[0] ?? "Tradicional");
    setSaborEnergetico(saboresEnergetico[0] ?? "Tradicional");
    setSaboresGelo(Array(6).fill(saboresDeGelo[0]));
    setSaborWhisky(saboresWhiskyJack[0] ?? "");
    setComboEmConfiguracao(produto);
  }

  function confirmarCombo() {
    if (!comboEmConfiguracao || !saborEnergetico || (comboEmConfiguracao.nome.toLowerCase().includes("askov") && !saborAskov)) return;
    const escolhas: EscolhasCombo = {
      energetico: saborEnergetico,
      gelos: saboresGelo,
      ...(comboEmConfiguracao.nome.toLowerCase().includes("askov") ? { askov: saborAskov } : {}),
      ...(comboEmConfiguracao.nome.toLowerCase().includes("jack daniel") ? { whisky: saborWhisky } : {}),
    };
    setCarrinho((itens) => [...itens, { ...comboEmConfiguracao, quantidade: 1, escolhasCombo: escolhas }]);
    setComboEmConfiguracao(null);
  }

  function valorNumerico(valor: string) {
    return Number(valor.replace(",", "."));
  }

  function resumoPagamento(pagamento: Pagamento, valor: number) {
    const rotulo = formasPagamento.find((forma) => forma.valor === pagamento.forma)?.rotulo;
    const troco = pagamento.forma === "dinheiro" && pagamento.precisaTroco
      ? ` (troco para ${formatarPreco(valorNumerico(pagamento.trocoPara))})`
      : "";
    return `${rotulo}: ${formatarPreco(valor)}${troco}`;
  }

  async function finalizarPedido() {
    if (!atendimentoAberto) {
      alert("A Guetto Delivery está fechada no momento.");
      return;
    }
    if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !rua.trim() || !numeroEndereco.trim() || !cidadeEntrega) {
      alert("Preencha nome, sobrenome, telefone, endereço e cidade para continuar.");
      return;
    }

    const pedidoMinimoCidade = cidadeEntrega === "Paranacity" ? 20 : 35;
    if (valorTotal < pedidoMinimoCidade) {
      alert(`O pedido mínimo para entrega em ${cidadeEntrega} é de ${formatarPreco(pedidoMinimoCidade)}.`);
      return;
    }

    if (!primeiroPagamento.forma) {
      alert("Escolha uma forma de pagamento.");
      return;
    }

    const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome.toLowerCase()]));
    const itensPorCategoria = (nomeCategoria: string) =>
      carrinho.filter((item) => categoriaPorId.get(item.categoria_id) === nomeCategoria);
    const subtotal = (itens: ItemCarrinho[]) =>
      itens.reduce((total, item) => total + item.preco * item.quantidade, 0);

    const itensTabacaria = itensPorCategoria("tabacaria");
    if (itensTabacaria.length > 0 && subtotal(itensTabacaria) < 20) {
      alert("O pedido mínimo para itens da Tabacaria é de R$ 20,00.");
      return;
    }

    const itensSucosERefrigerantes = itensPorCategoria("sucos e refrigerantes");
    if (itensSucosERefrigerantes.length > 0 && subtotal(itensSucosERefrigerantes) < 24) {
      alert("O pedido mínimo para Sucos e Refrigerantes é de R$ 24,00.");
      return;
    }

    const itensCerveja = itensPorCategoria("cervejas");
    const temCervejaAvulsa = itensCerveja.some((item) => item.tipo_venda === "avulso");
    const temCaixaFechada = itensCerveja.some((item) => item.tipo_venda !== "avulso");
    if (temCervejaAvulsa && !temCaixaFechada) {
      alert("Cervejas avulsas só são entregues junto com pelo menos uma caixa fechada.");
      return;
    }

    if (quantidadeGarrafas300 > 0 && quantidadeGarrafas300 < 10) {
      alert("O pedido mínimo para cervejas em garrafa de 300 ml é de 10 unidades.");
      return;
    }

    if (quantidadeGarrafas300 > 0 && !vasilhameConfirmado) {
      alert("Confirme que o vasilhame é obrigatório e não está incluso no pedido.");
      return;
    }

    const pagamentos = pagamentoDividido
      ? [primeiroPagamento, segundoPagamento]
      : [primeiroPagamento];

    if (pagamentoDividido && !segundoPagamento.forma) {
      alert("Escolha a segunda forma de pagamento.");
      return;
    }

    if (pagamentoDividido) {
      const soma = pagamentos.reduce((total, pagamento) => total + valorNumerico(pagamento.valor), 0);
      if (pagamentos.some((pagamento) => !pagamento.valor || valorNumerico(pagamento.valor) <= 0) || Math.abs(soma - valorTotal) > 0.01) {
        alert(`Os dois pagamentos precisam somar ${formatarPreco(valorTotal)}.`);
        return;
      }
    }

    if (pagamentos.some((pagamento) => pagamento.forma === "dinheiro" && pagamento.precisaTroco && valorNumerico(pagamento.trocoPara) <= 0)) {
      alert("Informe o valor para o qual o cliente precisa de troco.");
      return;
    }

    const linhas = carrinho.map(
      (item) =>
        `${item.quantidade}x ${item.nome} — ${formatarPreco(
          item.preco * item.quantidade
        )}${item.sabor ? `\n   Sabor: ${item.sabor}` : ""}${item.escolhasCombo ? `\n   Escolhas: ${[
          item.escolhasCombo.askov ? `Askov ${item.escolhasCombo.askov}` : "",
          `Energetico ${item.escolhasCombo.energetico}`,
          `6 gelos: ${item.escolhasCombo.gelos.join(", ")}`,
          item.escolhasCombo.whisky ? `Whisky Jack Daniel's ${item.escolhasCombo.whisky}` : "",
        ].filter(Boolean).join(" | ")}` : ""}`
    );
    const pagamentosFormatados = pagamentos.map((pagamento) =>
      resumoPagamento(pagamento, pagamentoDividido ? valorNumerico(pagamento.valor) : valorTotal)
    );
    const pedido = [
      "Olá! Gostaria de fazer este pedido:",
      "",
      `Cliente: ${nome.trim()} ${sobrenome.trim()}`,
      `Telefone: ${telefone.trim()}`,
      `Cidade: ${cidadeEntrega}`,
      `Endereço: ${rua.trim()}, ${numeroEndereco.trim()}`,
      ...(referencia.trim() ? [`Referência: ${referencia.trim()}`] : []),
      "",
      ...linhas,
      "",
      `Total: ${formatarPreco(valorTotal)}`,
      `Previsão de entrega: até ${tempoEntrega} minutos`,
      ...(quantidadeGarrafas300 > 0 ? ["Vasilhame: cliente confirmou que levará o próprio."] : []),
      "Pagamento:",
      ...pagamentosFormatados.map((pagamento) => `- ${pagamento}`),
    ].join("\n");

    const respostaPedido = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_nome: `${nome.trim()} ${sobrenome.trim()}`,
        telefone: telefone.trim(),
        endereco: `${rua.trim()}, ${numeroEndereco.trim()}`,
        referencia: referencia.trim() || null,
        itens: carrinho.map((item) => ({
          produto_id: item.id,
          quantidade: item.quantidade,
          escolhas_combo: item.sabor
            ? { sabor: item.sabor }
            : item.escolhasCombo ?? null,
        })),
        pagamento: pagamentosFormatados,
        tempo_entrega: tempoEntrega,
        observacao: [
          `Cidade de entrega: ${cidadeEntrega}.`,
          ...(quantidadeGarrafas300 > 0 ? ["Vasilhame confirmado pelo cliente."] : []),
        ].join(" "),
      }),
    });

    if (!respostaPedido.ok) {
      const erro = await respostaPedido.json().catch(() => null);
      alert(erro?.error ?? "Não foi possível registrar o pedido.");
      return;
    }

    try {
      await navigator.clipboard.writeText(pedido);
    } catch {
      // Copiar é apenas uma conveniência e não pode impedir a abertura do WhatsApp.
    }

    window.location.assign(
      `https://wa.me/${WHATSAPP_GUETTO}?text=${encodeURIComponent(pedido)}`
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-5 py-10 pb-28">
      <div className="mb-6 rounded-2xl border border-white/10 bg-black/25 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.24em] text-yellow-400">GUETTO DELIVERY</p>
          <h2 className="cardapio-title mt-2 text-3xl font-black uppercase sm:text-4xl">Cardápio</h2>
          <p className="mt-1 text-sm text-zinc-400">Entrega em até {tempoEntrega} minutos</p>
        </div>
        <button
          onClick={() => setCarrinhoAberto(true)}
          className="relative inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300"
          aria-label="Abrir carrinho"
        >
          <ShoppingBag size={20} /> Carrinho
          {quantidadeTotal > 0 && (
            <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-xs text-white">
              {quantidadeTotal}
            </span>
          )}
        </button>
        </div>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <p className="mt-4 text-sm text-zinc-300">Bebidas geladas, tabacaria e tudo para seu momento.</p>
      </div>

      {!atendimentoAberto && (
        <div className="mb-6 rounded-xl border border-red-500/50 bg-red-950/50 p-4 text-red-100">
          <p className="font-bold">A Guetto Delivery está encerrada no momento.</p>
          {horarioConfigurado ? (
            <p className="mt-1 text-sm">Atendimento de hoje: das {horarioAbertura} às {horarioFechamento}.</p>
          ) : (
            <p className="mt-1 text-sm">O horário de atendimento ainda não foi definido.</p>
          )}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-3">
        <button
          onClick={() => setCategoriaAtiva(null)}
          className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition ${
            categoriaAtiva === null
              ? "border-yellow-400 bg-yellow-400 text-black"
              : "border-zinc-700 bg-zinc-900 hover:border-yellow-400"
          }`}
        >
          Todos
        </button>
        {categorias.map((categoria) => (
          <button
            key={categoria.id}
            onClick={() => setCategoriaAtiva(categoria.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold transition ${
              categoriaAtiva === categoria.id
                ? "border-yellow-400 bg-yellow-400 text-black"
                : "border-zinc-700 bg-zinc-900 hover:border-yellow-400"
            }`}
          >
            {categoria.icone} {categoria.nome}
          </button>
        ))}
      </div>

      {produtosFiltrados.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700 p-10 text-center text-zinc-400">
          Nenhum produto disponível nesta categoria no momento.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {produtosFiltrados.map((produto) => {
            const item = carrinho.find((itemCarrinho) => itemCarrinho.id === produto.id);
            const semEstoque = estoqueDisponivel(produto) <= 0;
            const eCombo = categorias.find((categoria) => categoria.id === produto.categoria_id)?.nome === "Combos";
            const eGeloDeSabor = ["gelinho gourmet", "gelo de sabor"].includes(
              produto.nome.trim().toLowerCase()
            );
            const eJackDaniels = produto.nome.trim().toLowerCase() === "whisky jack daniels";
            const exigeEscolhaDeSabor =
              eGeloDeSabor ||
              eJackDaniels ||
              Boolean(produto.estoque_opcoes);

            return (
              <article
                key={produto.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-xl transition hover:-translate-y-1 hover:border-yellow-400/60"
              >
                <div className="relative aspect-square bg-zinc-800">
                  {produto.imagem ? (
                    <Image
                      src={produto.imagem}
                      alt={produto.nome}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-500">
                      Sem imagem
                    </div>
                  )}
                  {produto.destaque && (
                    <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                      Destaque
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-bold">{produto.nome}</h3>
                  {produto.descricao && (
                    <p className="mt-2 min-h-10 text-sm text-zinc-400">{produto.descricao}</p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="price-tag inline-flex rounded-md bg-red-600 px-3 py-1.5 text-xl font-black text-white">
                        {formatarPreco(produto.preco)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {semEstoque ? "Indisponível" : `${estoqueDisponivel(produto)} em estoque`}
                      </p>
                    </div>
                    {item && !exigeEscolhaDeSabor ? (
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
                        {exigeEscolhaDeSabor ? "Escolher sabor" : "Adicionar"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {geloEmConfiguracao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setGeloEmConfiguracao(null)}>
          <div className="w-full max-w-md rounded-2xl border border-yellow-400/50 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-400">
                  {geloEmConfiguracao.nome.toLowerCase().includes("jack daniel")
                    ? "Whisky Jack Daniel’s"
                    : geloEmConfiguracao.nome}
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
                  <option key={sabor} value={sabor}>{sabor}</option>
                ))}
              </select>
            </label>

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

      {comboEmConfiguracao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={() => setComboEmConfiguracao(null)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-yellow-400/50 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-400">Monte seu combo</h2>
                <p className="text-zinc-300">{comboEmConfiguracao.nome}</p>
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

              <label className="block text-sm font-bold">Sabor do energetico 2 L
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

      {carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={() => setCarrinhoAberto(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col bg-zinc-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
              <h2 className="text-2xl font-bold">Seu carrinho</h2>
              <button onClick={() => setCarrinhoAberto(false)} className="rounded-lg p-2 hover:bg-zinc-800" aria-label="Fechar carrinho">
                <X />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-5">
              {carrinho.length === 0 ? (
                <p className="text-center text-zinc-400">Seu carrinho está vazio.</p>
              ) : (
                <div className="space-y-4">
                  {carrinho.map((item) => (
                    <div key={chaveItem(item)} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {item.imagem ? <Image src={item.imagem} alt="" fill className="object-cover" sizes="64px" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{item.nome}</p>
                        {item.sabor && <p className="text-xs text-zinc-300">Sabor: {item.sabor}</p>}
                        <p className="text-sm text-yellow-400">{formatarPreco(item.preco)}</p>
                        {item.escolhasCombo && <p className="mt-1 text-xs text-zinc-400">{item.escolhasCombo.askov ? `Askov: ${item.escolhasCombo.askov} · ` : ""}Energetico: {item.escolhasCombo.energetico} · 6 gelos</p>}
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
              )}

              {carrinho.length > 0 && (
                <div className="mt-7 space-y-4 border-t border-zinc-800 pt-6">
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
                  <h3 className="text-lg font-bold">Dados para o pedido</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome" className="min-w-0 rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                    <input value={sobrenome} onChange={(event) => setSobrenome(event.target.value)} placeholder="Sobrenome" className="min-w-0 rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                  </div>
                  <input value={telefone} onChange={(event) => setTelefone(event.target.value)} inputMode="tel" placeholder="Telefone com DDD" className="w-full rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                  <div className="grid grid-cols-[1fr_7rem] gap-3">
                    <input value={rua} onChange={(event) => setRua(event.target.value)} placeholder="Rua / Avenida" className="min-w-0 rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                    <input value={numeroEndereco} onChange={(event) => setNumeroEndereco(event.target.value)} placeholder="Número" className="min-w-0 rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                  </div>
                  <input value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Ponto de referência (opcional)" className="w-full rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2" />
                  <select value={cidadeEntrega} onChange={(event) => setCidadeEntrega(event.target.value as "" | "Paranacity" | "Cruzeiro do Sul")} className="w-full rounded-lg bg-zinc-900 p-3 outline-none ring-yellow-400 focus:ring-2">
                    <option value="">Escolha a cidade de entrega</option>
                    <option value="Paranacity">Paranacity — pedido mínimo R$ 20,00</option>
                    <option value="Cruzeiro do Sul">Cruzeiro do Sul — pedido mínimo R$ 35,00</option>
                  </select>

                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">Pagamento</h3>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" checked={pagamentoDividido} onChange={(event) => setPagamentoDividido(event.target.checked)} />
                      Dividir em dois
                    </label>
                  </div>

                  <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
                    <p className="text-sm font-semibold text-zinc-300">{pagamentoDividido ? "1º pagamento" : "Forma de pagamento"}</p>
                    <select value={primeiroPagamento.forma} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, forma: event.target.value as FormaPagamento })} className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2">
                      <option value="">Escolha como pagar</option>
                      {formasPagamento.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
                    </select>
                    {pagamentoDividido && <input value={primeiroPagamento.valor} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, valor: event.target.value })} inputMode="decimal" placeholder="Valor deste pagamento" className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2" />}
                    {primeiroPagamento.forma === "dinheiro" && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={primeiroPagamento.precisaTroco} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, precisaTroco: event.target.checked })} /> Precisa de troco
                      </label>
                    )}
                    {primeiroPagamento.forma === "dinheiro" && primeiroPagamento.precisaTroco && <input value={primeiroPagamento.trocoPara} onChange={(event) => setPrimeiroPagamento({ ...primeiroPagamento, trocoPara: event.target.value })} inputMode="decimal" placeholder="Troco para quanto? Ex.: 100,00" className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2" />}
                  </div>

                  {pagamentoDividido && (
                    <div className="space-y-3 rounded-xl bg-zinc-900 p-4">
                      <p className="text-sm font-semibold text-zinc-300">2º pagamento</p>
                      <select value={segundoPagamento.forma} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, forma: event.target.value as FormaPagamento })} className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2">
                        <option value="">Escolha como pagar</option>
                        {formasPagamento.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
                      </select>
                      <input value={segundoPagamento.valor} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, valor: event.target.value })} inputMode="decimal" placeholder="Valor deste pagamento" className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2" />
                      {segundoPagamento.forma === "dinheiro" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={segundoPagamento.precisaTroco} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, precisaTroco: event.target.checked })} /> Precisa de troco</label>}
                      {segundoPagamento.forma === "dinheiro" && segundoPagamento.precisaTroco && <input value={segundoPagamento.trocoPara} onChange={(event) => setSegundoPagamento({ ...segundoPagamento, trocoPara: event.target.value })} inputMode="decimal" placeholder="Troco para quanto? Ex.: 100,00" className="w-full rounded-lg bg-zinc-800 p-3 outline-none ring-yellow-400 focus:ring-2" />}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="border-t border-zinc-800 pt-5">
              <div className="mb-4 flex justify-between text-lg font-bold"><span>Total</span><span className="text-yellow-400">{formatarPreco(valorTotal)}</span></div>
              <button onClick={finalizarPedido} disabled={carrinho.length === 0 || !atendimentoAberto} className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">
                Enviar pedido para WhatsApp
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
