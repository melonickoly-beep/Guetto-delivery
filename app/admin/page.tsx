"use client";

import { useEffect, useRef, useState, ChangeEvent, ClipboardEvent, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Categoria = {
  id: string;
  nome: string;
  icone: string;
};

type Produto = {
  id: string;
  categoria_id: string;
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  imagem: string;
  destaque: boolean;
  tipo_venda: "caixa" | "avulso" | null;
  produto_base_id?: string | null;
  estoque_opcoes?: Record<string, number> | null;
  grupo_estoque?: string | null;
  unidades_por_venda?: number | null;
  estoque_unidades?: number | null;
};

function estoqueDisponivelProduto(produto: Produto) {
  if (
    produto.grupo_estoque &&
    typeof produto.estoque_unidades === "number"
  ) {
    return Math.floor(
      produto.estoque_unidades / Math.max(1, produto.unidades_por_venda ?? 1)
    );
  }

  return produto.estoque;
}

type Pedido = {
  id: string;
  created_at: string;
  cliente_nome: string;
  telefone: string;
  endereco: string;
  referencia: string | null;
  itens: Array<{
    nome: string;
    quantidade: number;
    preco_unitario: number;
    escolhas_combo?: Record<string, string | string[]> | null;
  }>;
  total: number;
  pagamento: string[];
  observacao: string | null;
  status: string;
};

type AbaEstoque = "com-estoque" | "baixo-estoque" | "sem-estoque";

type ResumoPedidosHoje = {
  data: string | null;
  ativos: number;
  concluidos: number;
  total: number;
};

type DetalheSabor = {
  descricao?: string;
  imagem?: string;
};

type DetalhesEssencias = Record<string, Record<string, DetalheSabor>>;

const SABORES_GELO = [
  "Abacaxi",
  "Amora",
  "Brisa",
  "Coco",
  "Laranja",
  "Limão",
  "Maçã Verde",
  "Maracujá",
  "Melancia",
  "Morango",
  "Sal e Limão",
  "Uva Verde",
];

const statusPedido = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "em_preparo", rotulo: "Em preparo" },
  { valor: "saiu_para_entrega", rotulo: "Saiu para entrega" },
  { valor: "concluido", rotulo: "Concluir e excluir" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

export default function AdminPage() {
  const paginaEstoque = usePathname() === "/admin/estoque";
  const [painelDesbloqueado, setPainelDesbloqueado] = useState(false);
  const [verificandoAcesso, setVerificandoAcesso] = useState(true);
  const [emailAdmin, setEmailAdmin] = useState("");
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [erroAcesso, setErroAcesso] = useState("");
  const [validandoAcesso, setValidandoAcesso] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumoPedidosHoje, setResumoPedidosHoje] =
    useState<ResumoPedidosHoje | null>(null);
  const [notificacoesAtivadas, setNotificacoesAtivadas] = useState(false);
  const [alertaSonoroAtivado, setAlertaSonoroAtivado] = useState(false);
  const idsPedidosConhecidos = useRef<Set<string> | null>(null);
  const contextoAudioRef = useRef<AudioContext | null>(null);

  const [categoriaId, setCategoriaId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [destaque, setDestaque] = useState(false);
  const [tipoVenda, setTipoVenda] = useState<"caixa" | "avulso">("caixa");

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<string | null>(null);
  const [abaEstoque, setAbaEstoque] = useState<AbaEstoque>("com-estoque");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [buscaEstoque, setBuscaEstoque] = useState("");
  const [novosSabores, setNovosSabores] = useState<Record<string, string>>({});
  const [estoquesOpcoesSalvando, setEstoquesOpcoesSalvando] = useState<Set<string>>(
    new Set()
  );
  const [fotosSalvando, setFotosSalvando] = useState<Set<string>>(new Set());
  const [produtosSalvando, setProdutosSalvando] = useState<Set<string>>(
    new Set()
  );
  const [produtosSalvos, setProdutosSalvos] = useState<Set<string>>(new Set());
  const [estoquesEmEdicao, setEstoquesEmEdicao] = useState<
    Record<string, string>
  >({});
  const [estoquesOpcoesEmEdicao, setEstoquesOpcoesEmEdicao] = useState<
    Record<string, string>
  >({});
  const confirmacoesSalvasRef = useRef<Record<string, number>>({});
  const [detalhesEssencias, setDetalhesEssencias] = useState<DetalhesEssencias>({});
  const detalhesEssenciasRef = useRef<DetalhesEssencias>({});
  const [detalhesSaboresSalvando, setDetalhesSaboresSalvando] = useState<Set<string>>(
    new Set()
  );

  const [salvando, setSalvando] = useState(false);
  const [tempoEntrega, setTempoEntrega] = useState("20");
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [horarioAbertura, setHorarioAbertura] = useState("");
  const [horarioFechamento, setHorarioFechamento] = useState("");
  const [somenteRetirada, setSomenteRetirada] = useState(false);
  const [salvandoHorario, setSalvandoHorario] = useState(false);

  useEffect(() => {
    const desbloqueado =
      window.sessionStorage.getItem("guetto_admin_desbloqueado") === "1";

    if (desbloqueado) {
      setPainelDesbloqueado(true);
      setVerificandoAcesso(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setEmailAdmin(data.user?.email ?? "");
      setVerificandoAcesso(false);
    });
  }, []);

  useEffect(
    () => () => {
      Object.values(confirmacoesSalvasRef.current).forEach((temporizador) =>
        window.clearTimeout(temporizador)
      );
    },
    []
  );

  useEffect(() => {
    if (!painelDesbloqueado) return;

    if (paginaEstoque) {
      carregarCategorias();
      carregarProdutos();
      carregarDetalhesEssencias();
      return;
    }

    carregarTempoEntrega();
    carregarHorarioAtendimento();
    carregarPedidos();
    carregarResumoPedidos();

    const intervaloPedidos = window.setInterval(() => {
      carregarPedidos();
      carregarResumoPedidos();
    }, 10_000);
    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") {
        void carregarPainelPedidos();
      }
    };
    const canalPedidos = supabase
      .channel("pedidos-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        () => {
          void carregarPedidos();
          void carregarResumoPedidos();
        }
      )
      .subscribe();
    document.addEventListener("visibilitychange", atualizarAoVoltar);
    window.addEventListener("focus", atualizarAoVoltar);

    return () => {
      window.clearInterval(intervaloPedidos);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
      window.removeEventListener("focus", atualizarAoVoltar);
      void supabase.removeChannel(canalPedidos);
    };
  }, [painelDesbloqueado, paginaEstoque]); // eslint-disable-line react-hooks/exhaustive-deps -- Atualiza somente ao entrar ou sair de uma área do painel.

  useEffect(() => {
    const sincronizarPermissao = () => {
      setNotificacoesAtivadas(
        "Notification" in window && Notification.permission === "granted"
      );
    };

    sincronizarPermissao();
    window.addEventListener("focus", sincronizarPermissao);
    return () => window.removeEventListener("focus", sincronizarPermissao);
  }, []);

  useEffect(() => {
    if (!painelDesbloqueado || paginaEstoque) return;

    const removerEventos = () => {
      window.removeEventListener("pointerdown", tentarAtivarSom);
      window.removeEventListener("keydown", tentarAtivarSom);
      window.removeEventListener("touchstart", tentarAtivarSom);
    };
    const tentarAtivarSom = async () => {
      if (await prepararAlertaSonoro()) removerEventos();
    };

    void tentarAtivarSom();
    window.addEventListener("pointerdown", tentarAtivarSom);
    window.addEventListener("keydown", tentarAtivarSom);
    window.addEventListener("touchstart", tentarAtivarSom, { passive: true });

    return removerEventos;
  }, [painelDesbloqueado, paginaEstoque]);

  async function desbloquearPainel(event: FormEvent) {
    event.preventDefault();
    void prepararAlertaSonoro();
    setErroAcesso("");

    if (!emailAdmin) {
      setErroAcesso("Sua sessão expirou. Saia e entre novamente.");
      return;
    }

    setValidandoAcesso(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailAdmin,
      password: senhaAcesso,
    });
    setValidandoAcesso(false);

    if (error) {
      setErroAcesso("Senha inválida.");
      return;
    }

    window.sessionStorage.setItem("guetto_admin_desbloqueado", "1");
    setSenhaAcesso("");
    setPainelDesbloqueado(true);
  }

  async function carregarCategorias() {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");

    if (error) {
      alert(error.message);
      return;
    }

    setCategorias(data ?? []);
  }

  async function carregarProdutos() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome");

    if (error) {
      alert(error.message);
      return;
    }

    setProdutos(data ?? []);
  }

  async function carregarDetalhesEssencias() {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "detalhes_essencias")
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

    if (!data?.valor) {
      detalhesEssenciasRef.current = {};
      setDetalhesEssencias({});
      return;
    }

    try {
      const detalhesCarregados = JSON.parse(data.valor) as DetalhesEssencias;
      detalhesEssenciasRef.current = detalhesCarregados;
      setDetalhesEssencias(detalhesCarregados);
    } catch {
      detalhesEssenciasRef.current = {};
      setDetalhesEssencias({});
    }
  }

  async function salvarDetalheSabor(
    produtoId: string,
    sabor: string,
    alteracoes: DetalheSabor
  ) {
    const chaveSalvamento = `${produtoId}:${sabor}`;
    const detalhesAtuais = detalhesEssenciasRef.current;
    const detalhesAtualizados: DetalhesEssencias = {
      ...detalhesAtuais,
      [produtoId]: {
        ...(detalhesAtuais[produtoId] ?? {}),
        [sabor]: {
          ...(detalhesAtuais[produtoId]?.[sabor] ?? {}),
          ...alteracoes,
        },
      },
    };

    detalhesEssenciasRef.current = detalhesAtualizados;
    setDetalhesEssencias(detalhesAtualizados);
    setDetalhesSaboresSalvando((atuais) =>
      new Set(atuais).add(chaveSalvamento)
    );
    const { error } = await supabase.from("configuracoes").upsert({
      chave: "detalhes_essencias",
      valor: JSON.stringify(detalhesAtualizados),
    });
    setDetalhesSaboresSalvando((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(chaveSalvamento);
      return proximos;
    });

    if (error) {
      alert(error.message);
      void carregarDetalhesEssencias();
      return false;
    }

    return true;
  }

  async function atualizarProdutoRapido(
    id: string,
    alteracoes: Partial<
      Pick<
        Produto,
        | "categoria_id"
        | "nome"
        | "preco"
        | "estoque"
        | "descricao"
        | "imagem"
        | "destaque"
        | "tipo_venda"
        | "estoque_opcoes"
      >
    >
  ) {
    setProdutosSalvos((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(id);
      return proximos;
    });
    setProdutosSalvando((atuais) => new Set(atuais).add(id));

    try {
      const resposta = await fetch("/api/produtos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, alteracoes }),
      });
      const resultado = (await resposta.json()) as {
        produto?: Produto;
        produtos_relacionados?: Produto[];
        error?: string;
      };

      if (!resposta.ok) {
        throw new Error(resultado.error ?? "Não foi possível salvar o produto.");
      }

      if (!resultado.produto) {
        throw new Error("O servidor não confirmou o produto atualizado.");
      }

      const produtosAtualizados = new Map(
        (resultado.produtos_relacionados ?? [resultado.produto]).map(
          (produto) => [produto.id, produto]
        )
      );
      setProdutos((atuais) =>
        atuais.map((produto) => produtosAtualizados.get(produto.id) ?? produto)
      );
      if ("estoque" in alteracoes) {
        setEstoquesEmEdicao((atuais) => {
          const proximos = { ...atuais };
          delete proximos[id];
          return proximos;
        });
      }
      setProdutosSalvos((atuais) => new Set(atuais).add(id));

      if ("estoque" in alteracoes || "estoque_opcoes" in alteracoes) {
        await carregarProdutos();
      }

      window.clearTimeout(confirmacoesSalvasRef.current[id]);
      confirmacoesSalvasRef.current[id] = window.setTimeout(() => {
        setProdutosSalvos((atuais) => {
          const proximos = new Set(atuais);
          proximos.delete(id);
          return proximos;
        });
        delete confirmacoesSalvasRef.current[id];
      }, 2500);

      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
      void carregarProdutos();
      return false;
    } finally {
      setProdutosSalvando((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(id);
        return proximos;
      });
    }
  }

  async function salvarEstoqueDigitado(produto: Produto) {
    const valorDigitado =
      estoquesEmEdicao[produto.id] ?? String(estoqueDisponivelProduto(produto));
    const estoqueNormalizado = Number(valorDigitado);

    if (
      !valorDigitado.trim() ||
      !Number.isInteger(estoqueNormalizado) ||
      estoqueNormalizado < 0
    ) {
      alert("Informe uma quantidade inteira, igual ou maior que zero.");
      return;
    }

    await atualizarProdutoRapido(produto.id, {
      estoque: estoqueNormalizado,
    });
  }

  async function atualizarFotoProduto(produto: Produto, file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      return;
    }

    setFotosSalvando((atuais) => new Set(atuais).add(produto.id));

    try {
      const arquivoOtimizado = await otimizarImagem(file);
      const extensao = arquivoOtimizado.type === "image/webp"
        ? "webp"
        : arquivoOtimizado.name.split(".").pop();
      const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from("produtos")
        .upload(nomeArquivo, arquivoOtimizado);

      if (erroUpload) {
        alert(erroUpload.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("produtos").getPublicUrl(nomeArquivo);

      await atualizarProdutoRapido(produto.id, { imagem: publicUrl });
    } finally {
      setFotosSalvando((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(produto.id);
        return proximos;
      });
    }
  }

  async function atualizarFotoSabor(
    produto: Produto,
    sabor: string,
    file: File
  ) {
    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      return;
    }

    const chaveSalvamento = `${produto.id}:${sabor}`;
    setDetalhesSaboresSalvando((atuais) =>
      new Set(atuais).add(chaveSalvamento)
    );

    try {
      const arquivoOtimizado = await otimizarImagem(file);
      const extensao = arquivoOtimizado.type === "image/webp"
        ? "webp"
        : arquivoOtimizado.name.split(".").pop();
      const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from("produtos")
        .upload(nomeArquivo, arquivoOtimizado);

      if (erroUpload) {
        alert(erroUpload.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("produtos").getPublicUrl(nomeArquivo);

      await salvarDetalheSabor(produto.id, sabor, { imagem: publicUrl });
    } finally {
      setDetalhesSaboresSalvando((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(chaveSalvamento);
        return proximos;
      });
    }
  }

  const normalizarTexto = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  async function salvarEstoqueOpcoes(
    produto: Produto,
    estoqueOpcoes: Record<string, number>
  ) {
    const chaveSalvamento = produto.id;
    if (estoquesOpcoesSalvando.has(chaveSalvamento)) return false;

    const opcoesOrdenadas = Object.entries(estoqueOpcoes)
      .map(
        ([nomeOpcao, quantidade]): [string, number] => [
          nomeOpcao.trim(),
          Math.max(0, Math.floor(Number(quantidade) || 0)),
        ]
      )
      .filter(([nomeOpcao]) => Boolean(nomeOpcao))
      .sort(([opcaoA], [opcaoB]) => opcaoA.localeCompare(opcaoB, "pt-BR"))
      .reduce<Record<string, number>>(
        (opcoes, [nomeOpcao, quantidade]) => ({
          ...opcoes,
          [nomeOpcao]: quantidade,
        }),
        {}
      );
    const estoqueTotal = Object.values(opcoesOrdenadas).reduce(
      (total, quantidade) => total + Number(quantidade),
      0
    );
    const produtoEhEssencia = normalizarTexto(produto.nome).startsWith(
      "essencia"
    );
    const alteracoes = {
      estoque_opcoes: opcoesOrdenadas,
      estoque: estoqueTotal,
      ...(produtoEhEssencia
        ? { descricao: Object.keys(opcoesOrdenadas).join(", ") }
        : {}),
    };

    setEstoquesOpcoesSalvando((atuais) =>
      new Set(atuais).add(chaveSalvamento)
    );
    const salvou = await atualizarProdutoRapido(produto.id, alteracoes);
    setEstoquesOpcoesSalvando((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(chaveSalvamento);
      return proximos;
    });

    return salvou;
  }

  async function alterarEstoqueOpcao(
    produto: Produto,
    nomeOpcao: string,
    alteracao: number
  ) {
    const estoqueOpcoes = produto.estoque_opcoes ?? {};
    await salvarEstoqueOpcoes(produto, {
      ...estoqueOpcoes,
      [nomeOpcao]: Math.max(0, (estoqueOpcoes[nomeOpcao] ?? 0) + alteracao),
    });
  }

  async function salvarEstoqueOpcaoDigitado(
    produto: Produto,
    nomeOpcao: string
  ) {
    const chave = `${produto.id}:${nomeOpcao}`;
    const valorDigitado =
      estoquesOpcoesEmEdicao[chave] ??
      String(produto.estoque_opcoes?.[nomeOpcao] ?? 0);
    const estoqueNormalizado = Number(valorDigitado);

    if (
      !valorDigitado.trim() ||
      !Number.isInteger(estoqueNormalizado) ||
      estoqueNormalizado < 0
    ) {
      alert("Informe uma quantidade inteira, igual ou maior que zero.");
      return;
    }

    const salvou = await salvarEstoqueOpcoes(produto, {
      ...(produto.estoque_opcoes ?? {}),
      [nomeOpcao]: estoqueNormalizado,
    });

    if (salvou) {
      setEstoquesOpcoesEmEdicao((atuais) => {
        const proximos = { ...atuais };
        delete proximos[chave];
        return proximos;
      });
    }
  }

  async function adicionarOpcaoEstoque(produto: Produto) {
    const novaOpcao = (novosSabores[produto.id] ?? "").trim();
    if (!novaOpcao) return;

    const estoqueOpcoes = produto.estoque_opcoes ?? {};
    const opcaoExistente = Object.keys(estoqueOpcoes).find(
      (opcao) => normalizarTexto(opcao) === normalizarTexto(novaOpcao)
    );
    if (opcaoExistente) {
      alert("Este sabor já está cadastrado.");
      return;
    }

    const salvou = await salvarEstoqueOpcoes(produto, {
      ...estoqueOpcoes,
      [novaOpcao]: 1,
    });
    if (salvou) {
      setNovosSabores((atuais) => ({ ...atuais, [produto.id]: "" }));
    }
  }

  async function removerOpcaoEstoque(produto: Produto, nomeOpcao: string) {
    if (!confirm(`Remover o sabor “${nomeOpcao}” de ${produto.nome}?`)) return;

    const estoqueOpcoes = { ...(produto.estoque_opcoes ?? {}) };
    delete estoqueOpcoes[nomeOpcao];
    await salvarEstoqueOpcoes(produto, estoqueOpcoes);
  }

  async function carregarPedidos() {
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, created_at, cliente_nome, telefone, endereco, referencia, itens, total, pagamento, observacao, status")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return;

    const lista = data ?? [];
    let recebeuPedidoNovo = false;
    if (idsPedidosConhecidos.current === null) {
      idsPedidosConhecidos.current = new Set(
        lista.map((pedido) => pedido.id)
      );
      const pedidosAguardando = lista.filter(
        (pedido) => pedido.status === "novo"
      );
      if (pedidosAguardando.length > 0) {
        recebeuPedidoNovo = true;
        void exibirNotificacao(
          "Pedido aguardando na Guetto Delivery",
          pedidosAguardando.length === 1
            ? `Pedido de ${pedidosAguardando[0].cliente_nome} aguardando atendimento.`
            : `${pedidosAguardando.length} pedidos aguardando atendimento.`,
          "pedidos-aguardando"
        );
      }
    } else {
      for (const pedido of lista) {
        if (
          pedido.status === "novo" &&
          !idsPedidosConhecidos.current.has(pedido.id)
        ) {
          recebeuPedidoNovo = true;
          idsPedidosConhecidos.current.add(pedido.id);
          void exibirNotificacao(
            "Novo pedido na Guetto Delivery",
            `Pedido de ${pedido.cliente_nome} no valor de ${new Intl.NumberFormat(
              "pt-BR",
              { style: "currency", currency: "BRL" }
            ).format(Number(pedido.total))}.`,
            `pedido-${pedido.id}`
          );
        }
      }

      for (const pedido of lista) {
        idsPedidosConhecidos.current.add(pedido.id);
      }
    }

    if (recebeuPedidoNovo) {
      void tocarAlertaSonoro();
    }

    setPedidos(lista);
  }

  async function carregarResumoPedidos() {
    const resposta = await fetch("/api/admin/pedidos/resumo", {
      cache: "no-store",
    });

    if (!resposta.ok) return;

    const resumo = (await resposta.json()) as ResumoPedidosHoje;
    setResumoPedidosHoje(resumo);
  }

  async function carregarPainelPedidos() {
    await Promise.all([carregarPedidos(), carregarResumoPedidos()]);
  }

  async function atualizarStatusPedido(id: string, status: string) {
    if (
      status === "concluido" &&
      !confirm(
        "Concluir este pedido? Os dados do cliente e os itens serão excluídos automaticamente. Apenas a contagem será mantida."
      )
    ) {
      return false;
    }

    const resposta = await fetch(`/api/admin/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null);
      alert(erro?.error ?? "Não foi possível atualizar o pedido.");
      return false;
    }

    if (status === "concluido") {
      setPedidos((atuais) =>
        atuais.filter((pedidoAtual) => pedidoAtual.id !== id)
      );
      await carregarResumoPedidos();
    } else {
      setPedidos((atuais) =>
        atuais.map((pedido) =>
          pedido.id === id ? { ...pedido, status } : pedido
        )
      );
    }

    return true;
  }

  async function excluirPedidoCancelado(pedido: Pedido) {
    if (
      !confirm(
        `Excluir definitivamente o pedido cancelado de ${pedido.cliente_nome}?`
      )
    ) {
      return;
    }

    const resposta = await fetch(`/api/admin/pedidos/${pedido.id}`, {
      method: "DELETE",
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => null);
      alert(erro?.error ?? "Não foi possível excluir o pedido.");
      return;
    }

    setPedidos((atuais) =>
      atuais.filter((pedidoAtual) => pedidoAtual.id !== pedido.id)
    );
    await carregarResumoPedidos();
  }

  function textoSeguro(valor: unknown) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function resumirEscolhasRepetidas(escolhas: string[]) {
    const contagens = new Map<string, number>();

    for (const escolha of escolhas) {
      const nome = escolha.trim();
      if (!nome) continue;
      contagens.set(nome, (contagens.get(nome) ?? 0) + 1);
    }

    return Array.from(contagens, ([nome, quantidade]) =>
      `${quantidade}x ${nome}`
    ).join(", ");
  }

  function imprimirPedido(pedido: Pedido, janela: Window | null = null) {
    const janelaImpressao =
      janela ?? window.open("", "_blank", "width=420,height=720");

    if (!janelaImpressao) {
      alert("Permita pop-ups neste site para imprimir o pedido.");
      return;
    }

    const moeda = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const observacaoImpressao = (pedido.observacao ?? "")
      .replace(/atendimento\s*:\s*delivery\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const detalhesItens = (pedido.itens ?? [])
      .map((item) => {
        const escolhas = Object.entries(item.escolhas_combo ?? {})
          .map(([nomeEscolha, valor]) => {
            const escolha = Array.isArray(valor)
              ? resumirEscolhasRepetidas(valor)
              : valor;
            const rotuloEscolha =
              nomeEscolha === "whisky" &&
              item.nome.toLowerCase().includes("gin eternity")
                ? "gin"
                : nomeEscolha;
            return `<div class="detalhe">${textoSeguro(rotuloEscolha)}: ${textoSeguro(escolha)}</div>`;
          })
          .join("");
        const subtotalItem = Number(item.preco_unitario) * item.quantidade;

        return `
          <div class="item">
            <div><strong>${item.quantidade}x ${textoSeguro(item.nome)}</strong></div>
            ${escolhas}
            <div class="linha"><span>${moeda.format(Number(item.preco_unitario))} cada</span><span>${moeda.format(subtotalItem)}</span></div>
          </div>
        `;
      })
      .join("");

    janelaImpressao.document.open();
    janelaImpressao.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Pedido ${textoSeguro(pedido.id.slice(0, 8))}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            * { box-sizing: border-box; }
            body { width: 74mm; margin: 0 auto; color: #000; background: #fff; font: 12px/1.35 Arial, sans-serif; }
            h1, h2, p { margin: 0; }
            h1 { text-align: center; font-size: 20px; }
            h2 { margin-top: 3px; text-align: center; font-size: 14px; }
            .separador { margin: 8px 0; border-top: 1px dashed #000; }
            .item { margin-bottom: 8px; }
            .detalhe { padding-left: 8px; font-size: 11px; }
            .linha { display: flex; justify-content: space-between; gap: 8px; }
            .total { font-size: 17px; font-weight: 800; }
            .pagamento { margin: 6px 0; border: 2px solid #000; padding: 6px; font-size: 15px; font-weight: 900; }
            .pagamento.troco { border-width: 3px; font-size: 19px; line-height: 1.25; }
            .pagamento-titulo { display: block; font-size: 12px; letter-spacing: .5px; }
            .rodape { margin-top: 10px; text-align: center; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>GUETTO DELIVERY</h1>
          <h2>PEDIDO #${textoSeguro(pedido.id.slice(0, 8).toUpperCase())}</h2>
          <p style="text-align:center">${textoSeguro(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(pedido.created_at)))}</p>
          <div class="separador"></div>
          <p><strong>Cliente:</strong> ${textoSeguro(pedido.cliente_nome)}</p>
          <p><strong>Telefone:</strong> ${textoSeguro(pedido.telefone)}</p>
          <p><strong>${pedido.endereco === "Retirada na loja" ? "Atendimento" : "Endereço"}:</strong> ${textoSeguro(pedido.endereco)}</p>
          ${pedido.referencia ? `<p><strong>Referência:</strong> ${textoSeguro(pedido.referencia)}</p>` : ""}
          <div class="separador"></div>
          ${detalhesItens}
          <div class="separador"></div>
          <div class="linha total"><span>TOTAL</span><span>${moeda.format(Number(pedido.total))}</span></div>
          <div class="separador"></div>
          ${(pedido.pagamento ?? []).map((pagamento) => `<div class="pagamento ${/troco/i.test(pagamento) ? "troco" : ""}"><span class="pagamento-titulo">FORMA DE PAGAMENTO${/troco/i.test(pagamento) ? " / TROCO" : ""}</span>${textoSeguro(pagamento)}</div>`).join("")}
          ${observacaoImpressao ? `<p><strong>Observação:</strong> ${textoSeguro(observacaoImpressao)}</p>` : ""}
          <p class="rodape">Separar e conferir antes da ${pedido.endereco === "Retirada na loja" ? "retirada" : "entrega"}</p>
          <script>window.addEventListener("load", () => setTimeout(() => window.print(), 200));<\/script>
        </body>
      </html>`);
    janelaImpressao.document.close();
  }

  async function confirmarEImprimirPedido(pedido: Pedido) {
    const janelaImpressao = window.open("", "_blank", "width=420,height=720");
    if (!janelaImpressao) {
      alert("Permita pop-ups neste site para confirmar e imprimir o pedido.");
      return;
    }

    janelaImpressao.document.write("<p>Preparando pedido para impressão...</p>");
    const atualizado = await atualizarStatusPedido(pedido.id, "em_preparo");
    if (!atualizado) {
      janelaImpressao.close();
      return;
    }

    imprimirPedido({ ...pedido, status: "em_preparo" }, janelaImpressao);
  }

  async function sair() {
    window.sessionStorage.removeItem("guetto_admin_desbloqueado");
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function exibirNotificacao(
    titulo: string,
    corpo: string,
    tag: string
  ) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }

    const opcoes: NotificationOptions = {
      body: corpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      silent: false,
      data: { url: "/admin" },
    };

    try {
      if ("serviceWorker" in navigator) {
        const registro =
          (await navigator.serviceWorker.getRegistration("/")) ??
          (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await registro.showNotification(titulo, opcoes);
        return true;
      }
    } catch {
      // Alguns navegadores aceitam apenas a notificação direta.
    }

    try {
      new Notification(titulo, opcoes);
      return true;
    } catch {
      return false;
    }
  }

  async function prepararAlertaSonoro() {
    try {
      const JanelaComAudio = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const CriadorAudio =
        window.AudioContext ?? JanelaComAudio.webkitAudioContext;
      if (!CriadorAudio) return false;

      const contexto =
        contextoAudioRef.current ?? new CriadorAudio();
      contextoAudioRef.current = contexto;
      if (contexto.state === "suspended") await contexto.resume();
      const ativado = contexto.state === "running";
      setAlertaSonoroAtivado(ativado);
      return ativado;
    } catch {
      setAlertaSonoroAtivado(false);
      return false;
    }
  }

  async function tocarAlertaSonoro() {
    const contexto = contextoAudioRef.current;
    if (!contexto) return false;

    try {
      if (contexto.state === "suspended") await contexto.resume();
      if (contexto.state !== "running") return false;

      const inicio = contexto.currentTime;
      [740, 988, 740].forEach((frequencia, indice) => {
        const oscilador = contexto.createOscillator();
        const volume = contexto.createGain();
        const comecoNota = inicio + indice * 0.22;
        const fimNota = comecoNota + 0.17;

        oscilador.type = "sine";
        oscilador.frequency.setValueAtTime(frequencia, comecoNota);
        volume.gain.setValueAtTime(0.001, comecoNota);
        volume.gain.exponentialRampToValueAtTime(0.24, comecoNota + 0.025);
        volume.gain.exponentialRampToValueAtTime(0.001, fimNota);
        oscilador.connect(volume);
        volume.connect(contexto.destination);
        oscilador.start(comecoNota);
        oscilador.stop(fimNota);
      });
      return true;
    } catch {
      return false;
    }
  }

  async function ativarNotificacoes() {
    const somAtivado = await prepararAlertaSonoro();

    if (!("Notification" in window)) {
      if (somAtivado) {
        await tocarAlertaSonoro();
        alert("Alerta sonoro ativado. Este navegador não oferece notificações visuais.");
      } else {
        alert("Este navegador não oferece notificações.");
      }
      return;
    }

    const permissao = await Notification.requestPermission();
    setNotificacoesAtivadas(permissao === "granted");
    if (permissao !== "granted") {
      alert("Você pode liberar as notificações nas configurações do navegador depois.");
      return;
    }

    const exibiuTeste = await exibirNotificacao(
      "Notificações ativadas",
      "Você será avisado quando chegar um novo pedido.",
      "notificacoes-ativadas"
    );
    if (somAtivado) await tocarAlertaSonoro();
    if (!exibiuTeste) {
      alert(
        "A permissão foi concedida, mas o navegador bloqueou o aviso. Confira as configurações de notificação do site."
      );
    }
  }

  async function carregarTempoEntrega() {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "tempo_entrega")
      .maybeSingle();

    if (error) return;
    if (data?.valor) setTempoEntrega(data.valor);
  }

  async function salvarTempoEntrega() {
    const minutos = Number(tempoEntrega);

    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 90) {
      alert("Informe um prazo entre 1 e 90 minutos.");
      return;
    }

    setSalvandoEntrega(true);
    const { error } = await supabase.from("configuracoes").upsert({
      chave: "tempo_entrega",
      valor: String(minutos),
    });
    setSalvandoEntrega(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`Prazo atualizado: até ${minutos} minutos.`);
  }

  async function carregarHorarioAtendimento() {
    const { data, error } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [
        "horario_abertura",
        "horario_fechamento",
        "somente_retirada",
      ]);

    if (error) return;
    setHorarioAbertura(data?.find((configuracao) => configuracao.chave === "horario_abertura")?.valor ?? "");
    setHorarioFechamento(data?.find((configuracao) => configuracao.chave === "horario_fechamento")?.valor ?? "");
    setSomenteRetirada(
      data?.find((configuracao) => configuracao.chave === "somente_retirada")
        ?.valor === "true"
    );
  }

  async function salvarHorarioAtendimento() {
    if (!horarioAbertura || !horarioFechamento) {
      alert("Informe o horário de abertura e de encerramento.");
      return;
    }

    setSalvandoHorario(true);
    const { error } = await supabase.from("configuracoes").upsert([
      { chave: "horario_abertura", valor: horarioAbertura },
      { chave: "horario_fechamento", valor: horarioFechamento },
      { chave: "somente_retirada", valor: String(somenteRetirada) },
    ]);
    setSalvandoHorario(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      `Atendimento definido: das ${horarioAbertura} às ${horarioFechamento}. ${
        somenteRetirada
          ? "Site apenas para consulta; compras presenciais."
          : "Delivery disponível."
      }`
    );
  }

  async function otimizarImagem(file: File) {
    const imagem = await createImageBitmap(file);
    const limite = 1200;
    const escala = Math.min(1, limite / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * escala));
    const altura = Math.max(1, Math.round(imagem.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d");

    if (!contexto) {
      imagem.close();
      return file;
    }

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(imagem, 0, 0, largura, altura);
    imagem.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82)
    );

    if (!blob) return file;
    const nomeBase = file.name.replace(/\.[^.]+$/, "") || "produto";
    return new File([blob], `${nomeBase}.webp`, { type: "image/webp" });
  }

  async function definirImagem(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Cole ou selecione um arquivo de imagem.");
      return;
    }

    const arquivoOtimizado = await otimizarImagem(file);
    setArquivo(arquivoOtimizado);
    setPreview((previewAnterior) => {
      if (previewAnterior.startsWith("blob:")) URL.revokeObjectURL(previewAnterior);
      return URL.createObjectURL(arquivoOtimizado);
    });
  }

  async function selecionarImagem(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    await definirImagem(e.target.files[0]);
  }

  async function colarImagem(e: ClipboardEvent<HTMLDivElement>) {
    const imagem = Array.from(e.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();

    if (!imagem) return;
    e.preventDefault();
    await definirImagem(imagem);
  }

  async function uploadImagem() {
    if (!arquivo) return "";

    const extensao = arquivo.type === "image/webp"
      ? "webp"
      : arquivo.name.split(".").pop();

    const nomeArquivo =
      crypto.randomUUID() + "." + extensao;

    const { error } = await supabase.storage
      .from("produtos")
      .upload(nomeArquivo, arquivo);

    if (error) {
      alert(error.message);
      return "";
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("produtos")
      .getPublicUrl(nomeArquivo);

    return publicUrl;
  }

  function limparFormulario() {
    setCategoriaId("");
    setNome("");
    setDescricao("");
    setPreco("");
    setEstoque("");
    setDestaque(false);
    setTipoVenda("caixa");
    setArquivo(null);
    setPreview((previewAnterior) => {
      if (previewAnterior.startsWith("blob:")) URL.revokeObjectURL(previewAnterior);
      return "";
    });
    setProdutoEmEdicao(null);
  }

  function editarProduto(produto: Produto) {
    setProdutoEmEdicao(produto.id);
    setCategoriaId(produto.categoria_id);
    setNome(produto.nome);
    setDescricao(produto.descricao ?? "");
    setPreco(String(produto.preco));
    setEstoque(String(estoqueDisponivelProduto(produto)));
    setDestaque(produto.destaque);
    setTipoVenda(produto.tipo_venda ?? "caixa");
    setArquivo(null);
    setPreview(produto.imagem ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarProduto(e: FormEvent) {
    e.preventDefault();

    if (!categoriaId) {
      alert("Selecione uma categoria.");
      return;
    }

    setSalvando(true);

    const imagemNova = await uploadImagem();
    const dadosProduto = {
      categoria_id: categoriaId,
      nome,
      descricao,
      preco: Number(preco),
      estoque: Number(estoque),
      destaque,
      tipo_venda: tipoVenda,
    };

    if (produtoEmEdicao) {
      const salvou = await atualizarProdutoRapido(produtoEmEdicao, {
        ...dadosProduto,
        ...(imagemNova ? { imagem: imagemNova } : {}),
      });
      setSalvando(false);
      if (!salvou) return;
    } else {
      const { error } = await supabase
        .from("produtos")
        .insert({ ...dadosProduto, imagem: imagemNova });
      setSalvando(false);

      if (error) {
        alert(error.message);
        return;
      }
    }

    const estavaEditando = Boolean(produtoEmEdicao);
    limparFormulario();

    carregarProdutos();

    alert(estavaEditando ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
  }

  async function excluirProduto(id: string) {
    if (!confirm("Deseja realmente excluir este produto?")) {
      return;
    }

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    carregarProdutos();
  }

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const pedidosHoje = pedidos.filter((pedido) => new Date(pedido.created_at) >= inicioHoje);
  const pedidosNovos = pedidos.filter((pedido) => pedido.status === "novo");

  useEffect(() => {
    if (paginaEstoque) return;

    document.title = pedidosNovos.length > 0
      ? `(${pedidosNovos.length}) Novo pedido | Guetto Delivery`
      : "Painel Administrativo | Guetto Delivery";

    return () => {
      document.title = "Guetto Delivery";
    };
  }, [paginaEstoque, pedidosNovos.length]);

  useEffect(() => {
    if (!painelDesbloqueado || paginaEstoque || pedidosNovos.length === 0) {
      return;
    }

    const lembrete = window.setInterval(() => {
      void tocarAlertaSonoro();
      void exibirNotificacao(
        "Pedido ainda aguardando atendimento",
        pedidosNovos.length === 1
          ? "Há 1 pedido novo no painel."
          : `Há ${pedidosNovos.length} pedidos novos no painel.`,
        "lembrete-pedidos-novos"
      );
    }, 60_000);

    return () => window.clearInterval(lembrete);
  }, [painelDesbloqueado, paginaEstoque, pedidosNovos.length]);
  const produtosComEstoque = produtos.filter(
    (produto) => estoqueDisponivelProduto(produto) > 0
  );
  const produtosComEstoqueBaixo = produtos.filter(
    (produto) =>
      estoqueDisponivelProduto(produto) > 0 &&
      estoqueDisponivelProduto(produto) <= 5
  );
  const produtosSemEstoque = produtos.filter(
    (produto) => estoqueDisponivelProduto(produto) <= 0
  );
  const produtosDaAba =
    abaEstoque === "com-estoque"
      ? produtosComEstoque
      : abaEstoque === "baixo-estoque"
        ? produtosComEstoqueBaixo
        : produtosSemEstoque;
  const termoEstoque = buscaEstoque.trim().toLowerCase();
  const produtosVisiveis = produtosDaAba.filter(
    (produto) =>
      (categoriaFiltro === "todas" || produto.categoria_id === categoriaFiltro) &&
      (!termoEstoque ||
        `${produto.nome} ${produto.descricao ?? ""}`
          .toLowerCase()
          .includes(termoEstoque))
  );

  const produtosEnergeticos = produtos.filter((produto) =>
    normalizarTexto(produto.nome).startsWith("furioso 2l - ")
  );
  const produtosAskov = produtos.filter((produto) =>
    normalizarTexto(produto.nome).startsWith("askov 1l - ")
  );
  const produtoGeloDeSabor = produtos.find(
    (produto) => normalizarTexto(produto.nome) === "gelo de sabor"
  );

  function controleEstoqueComponente(produto: Produto, rotulo: string) {
    return (
      <form
        key={produto.id}
        className="flex items-center gap-2 rounded-lg bg-zinc-900 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void salvarEstoqueDigitado(produto);
        }}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={rotulo}>
          {rotulo}
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={
            estoquesEmEdicao[produto.id] ??
            String(estoqueDisponivelProduto(produto))
          }
          onChange={(event) =>
            setEstoquesEmEdicao((atuais) => ({
              ...atuais,
              [produto.id]: event.target.value,
            }))
          }
          className="w-20 rounded-md bg-zinc-800 px-2 py-1.5 text-center text-sm"
          aria-label={`Estoque compartilhado de ${rotulo}`}
        />
        <button
          type="submit"
          disabled={
            produtosSalvando.has(produto.id) ||
            !(produto.id in estoquesEmEdicao)
          }
          className="rounded-md bg-yellow-400 px-2 py-1.5 text-xs font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {produtosSalvando.has(produto.id) ? "..." : "Salvar"}
        </button>
      </form>
    );
  }

  function controleEstoqueOpcaoComponente(
    produto: Produto,
    sabor: string,
    quantidade: number
  ) {
    const chave = `${produto.id}:${sabor}`;

    return (
      <form
        key={chave}
        className="flex items-center gap-2 rounded-lg bg-zinc-900 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void salvarEstoqueOpcaoDigitado(produto, sabor);
        }}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={sabor}>
          {sabor}
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={estoquesOpcoesEmEdicao[chave] ?? String(quantidade)}
          onChange={(event) =>
            setEstoquesOpcoesEmEdicao((atuais) => ({
              ...atuais,
              [chave]: event.target.value,
            }))
          }
          className="w-20 rounded-md bg-zinc-800 px-2 py-1.5 text-center text-sm"
          aria-label={`Estoque compartilhado de ${sabor} em ${produto.nome}`}
        />
        <button
          type="submit"
          disabled={
            estoquesOpcoesSalvando.has(produto.id) ||
            !(chave in estoquesOpcoesEmEdicao)
          }
          className="rounded-md bg-yellow-400 px-2 py-1.5 text-xs font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {estoquesOpcoesSalvando.has(produto.id) ? "..." : "Salvar"}
        </button>
      </form>
    );
  }

  function painelEstoqueComponentesCombo(combo: Produto) {
    const nomeCombo = normalizarTexto(combo.nome);
    const baseDoCombo = combo.produto_base_id
      ? produtos.find((produto) => produto.id === combo.produto_base_id)
      : undefined;
    const destilados = nomeCombo === "combo askov"
      ? produtosAskov
      : baseDoCombo
        ? [baseDoCombo]
        : [];

    return (
      <details className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-3">
        <summary className="cursor-pointer font-bold text-yellow-300">
          Editar estoque dos itens deste combo
        </summary>
        <p className="mt-2 text-xs text-zinc-400">
          Estoque compartilhado: qualquer alteração feita aqui também muda o
          produto avulso e os outros combos que usam o mesmo item.
        </p>

        {destilados.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-zinc-200">
              {nomeCombo === "combo askov"
                ? "Vodkas por sabor"
                : baseDoCombo?.estoque_opcoes
                  ? normalizarTexto(baseDoCombo.nome).includes("gin")
                    ? "Gin por sabor"
                    : "Whisky por sabor"
                  : "Destilado"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {destilados.flatMap((destilado) =>
                destilado.estoque_opcoes
                  ? Object.entries(destilado.estoque_opcoes)
                      .sort(([saborA], [saborB]) =>
                        saborA.localeCompare(saborB, "pt-BR")
                      )
                      .map(([sabor, quantidade]) =>
                        controleEstoqueOpcaoComponente(
                          destilado,
                          sabor,
                          quantidade
                        )
                      )
                  : [
                      controleEstoqueComponente(
                        destilado,
                        destilado.nome
                          .replace(/^Askov 1L - /i, "")
                          .replace(/^Whisky /i, "")
                      ),
                    ]
              )}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-zinc-200">
            Energéticos por sabor
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {produtosEnergeticos.map((energetico) =>
              controleEstoqueComponente(
                energetico,
                energetico.nome.replace(/^Furioso 2L - /i, "")
              )
            )}
          </div>
        </div>

        {produtoGeloDeSabor && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-zinc-200">
              Gelos por sabor
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SABORES_GELO.map((sabor) =>
                controleEstoqueOpcaoComponente(
                  produtoGeloDeSabor,
                  sabor,
                  produtoGeloDeSabor.estoque_opcoes?.[sabor] ?? 0
                )
              )}
            </div>
          </div>
        )}
      </details>
    );
  }

  if (verificandoAcesso) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-white">
        <p className="text-zinc-400">Verificando acesso...</p>
      </main>
    );
  }

  function abrirWhatsAppStatus(pedido: Pedido) {
    const mensagens: Record<string, string> = {
      novo: "Olá! Recebemos seu pedido na Guetto Delivery.",
      em_preparo: "Seu pedido já está em preparo.",
      saiu_para_entrega: "Seu pedido saiu para entrega!",
      concluido: "Seu pedido foi entregue. Obrigado pela preferência!",
      cancelado: "Seu pedido foi cancelado. Entre em contato conosco se precisar de ajuda.",
    };
    const telefoneLimpo = pedido.telefone.replace(/\D/g, "");
    const telefoneWhatsApp = telefoneLimpo.startsWith("55")
      ? telefoneLimpo
      : `55${telefoneLimpo}`;
    const acompanhamento = `${window.location.origin}/acompanhar/${pedido.id}`;
    const mensagem = `${mensagens[pedido.status] ?? "Atualização do seu pedido:"}\n\nAcompanhe aqui:\n${acompanhamento}`;
    window.open(
      `https://web.whatsapp.com/send?phone=${telefoneWhatsApp}&text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!painelDesbloqueado) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-white">
        <form
          onSubmit={desbloquearPainel}
          className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8"
        >
          <h1 className="mb-3 text-center text-3xl font-bold text-yellow-400">
            Painel protegido
          </h1>
          <p className="mb-6 text-center text-zinc-400">
            Digite sua senha para abrir o painel administrativo.
          </p>
          <input
            type="password"
            placeholder="Senha"
            value={senhaAcesso}
            onChange={(event) => setSenhaAcesso(event.target.value)}
            autoComplete="current-password"
            autoFocus
            className="mb-4 w-full rounded-lg bg-zinc-800 p-3 text-white outline-none"
            required
          />
          {erroAcesso && (
            <div className="mb-4 rounded-lg bg-red-900 p-3 text-red-200">
              {erroAcesso}
            </div>
          )}
          <button
            type="submit"
            disabled={validandoAcesso}
            className="w-full rounded-lg bg-yellow-400 p-3 font-bold text-black disabled:opacity-60"
          >
            {validandoAcesso ? "Verificando..." : "Abrir painel"}
          </button>
          <button
            type="button"
            onClick={sair}
            className="mt-3 w-full rounded-lg border border-zinc-700 p-3 font-semibold text-zinc-300"
          >
            Sair da conta
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto p-8">

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-4xl font-bold text-yellow-400">
              {paginaEstoque ? "Estoque" : "Painel Administrativo"}
            </h1>
            {paginaEstoque && (
              <p className="mt-2 text-zinc-400">
                Cadastre produtos e atualize preços, quantidades e sabores.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={paginaEstoque ? "/admin" : "/admin/estoque"}
              className="rounded-lg bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-300"
            >
              {paginaEstoque ? "Voltar ao painel" : "Estoque"}
            </Link>
            <Link
              href="/admin/sorteio"
              className="rounded-lg border border-yellow-400 px-4 py-2 font-bold text-yellow-300 hover:bg-yellow-400/10"
            >
              Resumo diário
            </Link>
            <button type="button" onClick={sair} className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold hover:bg-zinc-800">
              Sair
            </button>
          </div>
        </div>

        {!paginaEstoque && (
          <>
        <section className="mb-8 rounded-xl border border-yellow-400/50 bg-yellow-400/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Pedidos de hoje: {resumoPedidosHoje?.total ?? pedidosHoje.length}
              </h2>
              <p className="text-zinc-300">
                {pedidosNovos.length > 0 ? `${pedidosNovos.length} novo(s) aguardando atendimento.` : "Nenhum pedido novo aguardando atendimento."}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Os pedidos aparecem aqui mesmo que o cliente não envie a mensagem no WhatsApp.
              </p>
              {pedidosNovos.length > 0 && (
                <p className="mt-1 text-sm font-bold text-yellow-200">
                  O painel repetirá o alerta a cada minuto até o pedido ser atendido.
                </p>
              )}
            </div>
            <button type="button" onClick={ativarNotificacoes} className="rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300">
              {notificacoesAtivadas && alertaSonoroAtivado
                ? "Alertas automáticos ativados"
                : notificacoesAtivadas
                  ? "Som automático ao usar o painel"
                  : "Permitir notificações"}
            </button>
          </div>
          {pedidosNovos.length > 0 && (
            <div className="mt-4 rounded-lg bg-red-600 px-4 py-3 font-bold text-white">
              🔔 Você tem {pedidosNovos.length} pedido(s) novo(s).
            </div>
          )}
        </section>

        <details open={pedidosNovos.length > 0} className="group mb-4 rounded-xl border border-zinc-800 bg-zinc-900">
          <summary className="cursor-pointer list-none rounded-xl px-6 py-5 text-xl font-bold hover:bg-zinc-800">
            <span className="flex items-center justify-between">
              Pedidos recentes
              <span className="text-yellow-400 transition group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="border-t border-zinc-800 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-zinc-400">Acompanhe e atualize o andamento dos pedidos.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Atualização automática a cada 10 segundos e aviso imediato quando disponível.
              </p>
            </div>
            <button type="button" onClick={() => void carregarPainelPedidos()} className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-800">
              Atualizar
            </button>
          </div>

          <div className="grid gap-4">
            {pedidos.length === 0 && <p className="text-zinc-400">Nenhum pedido registrado.</p>}
            {pedidos.map((pedido) => (
              <article key={pedido.id} className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <p className="text-sm text-zinc-500">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(pedido.created_at))}
                    </p>
                    <h3 className="text-xl font-bold">{pedido.cliente_nome}</h3>
                    <p className="text-zinc-300">{pedido.telefone}</p>
                    <p className="text-zinc-300">
                      {pedido.endereco}{pedido.referencia ? ` — ${pedido.referencia}` : ""}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-2xl font-black text-yellow-400">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(pedido.total))}
                    </p>
                    <select
                      value={pedido.status}
                      onChange={(event) =>
                        void atualizarStatusPedido(
                          pedido.id,
                          event.target.value
                        )
                      }
                      className="mt-2 rounded-lg bg-zinc-800 p-2"
                      aria-label={`Status do pedido de ${pedido.cliente_nome}`}
                    >
                      {statusPedido
                        .filter(
                          (status) =>
                            pedido.endereco !== "Retirada na loja" ||
                            status.valor !== "saiu_para_entrega"
                        )
                        .map((status) => (
                        <option key={status.valor} value={status.valor}>{status.rotulo}</option>
                        ))}
                    </select>
                    {pedido.status !== "saiu_para_entrega" &&
                      pedido.status !== "concluido" &&
                      pedido.status !== "cancelado" &&
                      pedido.endereco !== "Retirada na loja" && (
                        <button
                          type="button"
                          onClick={() =>
                            void atualizarStatusPedido(
                              pedido.id,
                              "saiu_para_entrega"
                            )
                          }
                          className="mt-2 block w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-500"
                        >
                          Marcar como saiu para entrega
                        </button>
                      )}
                  </div>
                </div>
                <ul className="mt-4 space-y-1 border-t border-zinc-800 pt-4 text-sm text-zinc-300">
                  {(pedido.itens ?? []).map((item, indice) => (
                    <li key={`${item.nome}-${indice}`}>
                      {item.quantidade}x {item.nome}
                    </li>
                  ))}
                </ul>
                {(pedido.pagamento?.length > 0 || pedido.observacao) && (
                  <div className="mt-4 text-sm text-zinc-400">
                    {pedido.pagamento?.map((pagamento) => <p key={pagamento}>{pagamento}</p>)}
                    {pedido.observacao && <p>{pedido.observacao}</p>}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                  {pedido.status === "novo" ? (
                    <button
                      type="button"
                      onClick={() => confirmarEImprimirPedido(pedido)}
                      className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-300"
                    >
                      Confirmar e imprimir
                    </button>
                  ) : pedido.status !== "cancelado" ? (
                    <button
                      type="button"
                      onClick={() => imprimirPedido(pedido)}
                      className="rounded-lg border border-yellow-400 px-3 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-400/10"
                    >
                      Imprimir novamente
                    </button>
                  ) : null}
                  <a
                    href={`/acompanhar/${pedido.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold hover:bg-zinc-800"
                  >
                    Ver acompanhamento
                  </a>
                  <button
                    type="button"
                    onClick={() => abrirWhatsAppStatus(pedido)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-500"
                  >
                    Avisar cliente no WhatsApp
                  </button>
                  {pedido.status === "cancelado" && (
                    <button
                      type="button"
                      onClick={() => void excluirPedidoCancelado(pedido)}
                      className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-600"
                    >
                      Excluir pedido
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          </div>
        </details>

        <details className="group mb-4 rounded-xl border border-zinc-800 bg-zinc-900">
          <summary className="cursor-pointer list-none rounded-xl px-6 py-5 text-xl font-bold hover:bg-zinc-800">
            <span className="flex items-center justify-between">
              Prazo de entrega
              <span className="text-yellow-400 transition group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="border-t border-zinc-800 p-6">
          <p className="mt-1 text-zinc-400">Este prazo aparece para o cliente e no pedido enviado pelo WhatsApp.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2">
              <span className="sr-only">Prazo de entrega em minutos</span>
              <input
                type="number"
                min="1"
                max="90"
                value={tempoEntrega}
                onChange={(event) => setTempoEntrega(event.target.value)}
                className="w-28 rounded-lg bg-zinc-800 p-3"
              />
              <span>minutos</span>
            </label>
            <button
              type="button"
              onClick={salvarTempoEntrega}
              disabled={salvandoEntrega}
              className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-60"
            >
              {salvandoEntrega ? "Salvando..." : "Salvar prazo"}
            </button>
          </div>
          <p className="mt-3 text-sm text-zinc-500">Exemplos: 20 minutos em dias tranquilos; 90 minutos em dias mais corridos.</p>
          </div>
        </details>

        <details className="group mb-8 rounded-xl border border-zinc-800 bg-zinc-900">
          <summary className="cursor-pointer list-none rounded-xl px-6 py-5 text-xl font-bold hover:bg-zinc-800">
            <span className="flex items-center justify-between">
              Horário e tipo de atendimento
              <span className="text-yellow-400 transition group-open:rotate-180">⌄</span>
            </span>
          </summary>
          <div className="border-t border-zinc-800 p-6">
          <p className="mt-1 text-zinc-400">Fora deste intervalo, o catálogo bloqueia novos pedidos automaticamente.</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4">
            <input
              type="checkbox"
              checked={somenteRetirada}
              onChange={(event) => setSomenteRetirada(event.target.checked)}
              className="mt-1"
            />
            <span>
              <strong className="block text-yellow-300">
                Somente retirada na loja — compra presencial
              </strong>
              <span className="text-sm text-zinc-300">
                Bloqueia todos os pedidos pelo site e deixa o cardápio apenas
                para consulta. As compras são feitas presencialmente na loja.
                Às terças-feiras isso acontece automaticamente, mesmo com esta
                opção desmarcada.
              </span>
            </span>
          </label>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-300">Abre às</span>
              <input type="time" value={horarioAbertura} onChange={(event) => setHorarioAbertura(event.target.value)} className="rounded-lg bg-zinc-800 p-3" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-300">Encerra às</span>
              <input type="time" value={horarioFechamento} onChange={(event) => setHorarioFechamento(event.target.value)} className="rounded-lg bg-zinc-800 p-3" />
            </label>
            <button type="button" onClick={salvarHorarioAtendimento} disabled={salvandoHorario} className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-60">
              {salvandoHorario ? "Salvando..." : "Salvar horário"}
            </button>
          </div>
          </div>
        </details>
          </>
        )}

        {paginaEstoque && (
          <>
        <form
          onSubmit={salvarProduto}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10"
        >

          {produtoEmEdicao && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-400/50 bg-yellow-400/10 p-4">
              <strong className="text-yellow-300">Editando: {nome}</strong>
              <button type="button" onClick={limparFormulario} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800">
                Cancelar edição
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">

            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            >
              <option value="">
                Escolha uma categoria
              </option>

              {categorias.map((categoria) => (
                <option
                  key={categoria.id}
                  value={categoria.id}
                >
                  {categoria.nome}
                </option>
              ))}
            </select>

            {categorias.find((categoria) => categoria.id === categoriaId)?.nome.toLowerCase() === "cervejas" && (
              <select
                value={tipoVenda}
                onChange={(e) => setTipoVenda(e.target.value as "caixa" | "avulso")}
                className="bg-zinc-800 rounded-lg p-3"
              >
                <option value="caixa">Caixa fechada</option>
                <option value="avulso">Unidade avulsa</option>
              </select>
            )}

            <input
              type="text"
              placeholder="Nome do produto"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            {categorias.find(
              (categoria) => categoria.id === categoriaId
            )?.nome.toLowerCase() === "tabacaria" &&
              nome
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim()
                .startsWith("essencia") && (
                <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100 md:col-span-2">
                  Este produto aparecerá na subseção <strong>Essências</strong>.
                  Use o campo “Imagem do produto” abaixo para cadastrar a foto
                  individual dele.
                </p>
              )}

            <textarea
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3 md:col-span-2 h-28"
            />
                        <input
              type="number"
              step="0.01"
              placeholder="Preço"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            <input
              type="number"
              placeholder="Estoque"
              value={estoque}
              onChange={(e) => setEstoque(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            <div
              className="md:col-span-2 rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 p-5 focus-within:border-yellow-400"
              onPaste={colarImagem}
              tabIndex={0}
              role="group"
              aria-label="Imagem do produto"
            >
              <p className="mb-3 font-semibold">Imagem do produto</p>
              <input
                type="file"
                accept="image/*"
                onChange={selecionarImagem}
                className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-bold file:text-black hover:file:bg-yellow-300"
              />
              <p className="mt-3 text-sm text-zinc-400">
                Ou copie uma imagem e pressione <kbd className="rounded bg-zinc-700 px-2 py-1 text-zinc-200">Ctrl+V</kbd> nesta área.
              </p>
              <p className="mt-2 text-xs text-emerald-300">
                A imagem será centralizada, reduzida e convertida para WebP automaticamente.
              </p>
            </div>

            {preview && (

              <div className="md:col-span-2">

                <Image
                  src={preview}
                  alt="Preview"
                  width={220}
                  height={220}
                  className="aspect-square rounded-lg border border-zinc-700 bg-white object-contain p-2"
                />

              </div>

            )}

            <label className="md:col-span-2 flex items-center gap-3">

              <input
                type="checkbox"
                checked={destaque}
                onChange={(e) =>
                  setDestaque(e.target.checked)
                }
              />

              <span>Produto em destaque</span>

            </label>

          </div>

          <button
            type="submit"
            disabled={salvando}
            className="mt-8 bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-lg transition"
          >
            {salvando ? "Salvando..." : produtoEmEdicao ? "Salvar alterações" : "Salvar Produto"}
          </button>

        </form>

        <h2 className="text-3xl font-bold mb-6">
          Produtos cadastrados
        </h2>

        <div className="mb-6 flex gap-2 border-b border-zinc-700" role="tablist" aria-label="Filtrar produtos por estoque">
          <button
            type="button"
            role="tab"
            aria-selected={abaEstoque === "com-estoque"}
            onClick={() => setAbaEstoque("com-estoque")}
            className={`rounded-t-lg px-5 py-3 font-semibold transition ${
              abaEstoque === "com-estoque"
                ? "bg-yellow-400 text-black"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Com estoque ({produtosComEstoque.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaEstoque === "baixo-estoque"}
            onClick={() => setAbaEstoque("baixo-estoque")}
            className={`rounded-t-lg px-5 py-3 font-semibold transition ${
              abaEstoque === "baixo-estoque"
                ? "bg-orange-500 text-black"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Estoque baixo ({produtosComEstoqueBaixo.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={abaEstoque === "sem-estoque"}
            onClick={() => setAbaEstoque("sem-estoque")}
            className={`rounded-t-lg px-5 py-3 font-semibold transition ${
              abaEstoque === "sem-estoque"
                ? "bg-red-600 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Sem estoque ({produtosSemEstoque.length})
          </button>
        </div>

        <div className="mb-6 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Pesquisar produto</span>
            <input
              value={buscaEstoque}
              onChange={(event) => setBuscaEstoque(event.target.value)}
              placeholder="Nome, marca ou descrição"
              className="rounded-lg bg-zinc-800 p-3"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Categoria dos produtos</span>
            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
              className="rounded-lg bg-zinc-800 p-3"
            >
              <option value="todas">Todas as categorias ({produtosDaAba.length})</option>
              {categorias.map((categoria) => {
                const quantidade = produtosDaAba.filter(
                  (produto) => produto.categoria_id === categoria.id
                ).length;

                return (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome} ({quantidade})
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="grid gap-4">
          {produtosVisiveis.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">
              Nenhum produto encontrado neste filtro.
            </div>
          )}

          {produtosVisiveis.map((produto) => (
            <div
              key={produto.id}
              className="flex flex-col items-start justify-between gap-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5 md:flex-row"
            >
              <div className="flex w-full min-w-0 items-start gap-5">

                <div
                  className="w-[90px] shrink-0 rounded-md outline-none focus:ring-2 focus:ring-yellow-400"
                  onPaste={(event) => {
                    const foto = Array.from(event.clipboardData.items)
                      .find(
                        (item) =>
                          item.kind === "file" && item.type.startsWith("image/")
                      )
                      ?.getAsFile();
                    if (!foto) return;
                    event.preventDefault();
                    void atualizarFotoProduto(produto, foto);
                  }}
                  tabIndex={0}
                  role="group"
                  aria-label={`Foto de ${produto.nome}. Cole uma imagem com Control V.`}
                >
                  {produto.imagem ? (
                    <Image
                      src={produto.imagem}
                      alt={produto.nome}
                      width={90}
                      height={90}
                      className="aspect-square rounded-lg bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-[90px] w-[90px] items-center justify-center rounded-lg bg-zinc-800 text-center text-xs text-zinc-500">
                      Sem imagem
                    </div>
                  )}
                  <label
                    className={`mt-2 block cursor-pointer rounded-md border border-zinc-600 px-2 py-1.5 text-center text-xs font-semibold hover:bg-zinc-800 ${
                      fotosSalvando.has(produto.id) ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    {fotosSalvando.has(produto.id)
                      ? "Salvando..."
                      : produto.imagem
                        ? "Trocar foto"
                        : "Adicionar foto"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={fotosSalvando.has(produto.id)}
                      onChange={(event) => {
                        const foto = event.target.files?.[0];
                        event.target.value = "";
                        if (foto) void atualizarFotoProduto(produto, foto);
                      }}
                      className="sr-only"
                      aria-label={`${produto.imagem ? "Trocar" : "Adicionar"} foto de ${produto.nome}`}
                    />
                  </label>
                  <p className="mt-1 text-center text-[10px] text-zinc-500">
                    ou cole com Ctrl+V
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <span className="mb-2 inline-block rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {categorias.find((categoria) => categoria.id === produto.categoria_id)?.nome ?? "Sem categoria"}
                  </span>

                  <label className="block max-w-2xl">
                    <span className="sr-only">Título do produto</span>
                    <input
                      type="text"
                      defaultValue={produto.nome}
                      maxLength={120}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          event.currentTarget.value = produto.nome;
                          event.currentTarget.blur();
                        }
                      }}
                      onBlur={async (event) => {
                        const campo = event.currentTarget;
                        const novoNome = campo.value.trim();

                        if (!novoNome) {
                          alert("Informe o título do produto.");
                          campo.value = produto.nome;
                          return;
                        }

                        campo.value = novoNome;
                        if (novoNome === produto.nome) return;

                        const salvou = await atualizarProdutoRapido(produto.id, {
                          nome: novoNome,
                        });
                        if (!salvou) campo.value = produto.nome;
                      }}
                      className="w-full border-b border-transparent bg-transparent py-1 text-xl font-bold text-white outline-none transition hover:border-zinc-600 focus:border-yellow-400"
                      aria-label={`Título de ${produto.nome}`}
                      title="Clique para editar o título"
                    />
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Clique no título para editar. Salva ao sair ou pressionar Enter.
                    </span>
                  </label>

                  <label className="mt-3 flex max-w-2xl flex-col gap-1 text-sm">
                    <span className="font-semibold text-zinc-300">
                      Observação / descrição
                    </span>
                    <textarea
                      defaultValue={produto.descricao ?? ""}
                      placeholder="Adicione uma observação sobre o produto"
                      onBlur={(event) => {
                        const novaDescricao = event.target.value.trim();
                        if (novaDescricao !== (produto.descricao ?? "")) {
                          void atualizarProdutoRapido(produto.id, {
                            descricao: novaDescricao,
                          });
                        }
                      }}
                      className="min-h-20 w-full resize-y rounded-md bg-zinc-800 px-3 py-2 text-zinc-200"
                      aria-label={`Observação de ${produto.nome}`}
                    />
                    <span className="text-xs text-zinc-500">
                      Salva automaticamente ao sair do campo.
                    </span>
                  </label>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">Preço R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={produto.preco.toFixed(2)}
                        onBlur={(event) => {
                          const novoPreco = Number(event.target.value);
                          if (
                            Number.isFinite(novoPreco) &&
                            novoPreco >= 0 &&
                            novoPreco !== produto.preco
                          ) {
                            void atualizarProdutoRapido(produto.id, {
                              preco: novoPreco,
                            });
                          }
                        }}
                        className="w-24 rounded-md bg-zinc-800 px-2 py-1.5"
                        aria-label={`Preço de ${produto.nome}`}
                      />
                    </label>

                    {produto.estoque_opcoes ? (
                      <span className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-semibold text-yellow-300">
                        Estoque total: {produto.estoque}
                      </span>
                    ) : (
                      <form
                        className="flex flex-wrap items-center gap-2 text-sm"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void salvarEstoqueDigitado(produto);
                        }}
                      >
                        <span className="font-semibold">Estoque</span>
                        <button
                          type="button"
                          onClick={() =>
                            void atualizarProdutoRapido(produto.id, {
                              estoque: Math.max(
                                0,
                                estoqueDisponivelProduto(produto) - 1
                              ),
                            })
                          }
                          disabled={
                            produtosSalvando.has(produto.id) ||
                            produto.id in estoquesEmEdicao
                          }
                          className="grid h-8 w-8 place-items-center rounded-md bg-zinc-800 text-lg hover:bg-zinc-700"
                          aria-label={`Diminuir estoque de ${produto.nome}`}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            estoquesEmEdicao[produto.id] ??
                            String(estoqueDisponivelProduto(produto))
                          }
                          onChange={(event) =>
                            setEstoquesEmEdicao((atuais) => ({
                              ...atuais,
                              [produto.id]: event.target.value,
                            }))
                          }
                          className="w-16 rounded-md bg-zinc-800 px-2 py-1.5 text-center"
                          aria-label={`Estoque de ${produto.nome}`}
                        />
                        <button
                          type="submit"
                          disabled={
                            produtosSalvando.has(produto.id) ||
                            !(produto.id in estoquesEmEdicao)
                          }
                          className="rounded-md bg-yellow-400 px-3 py-1.5 font-bold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Salvar estoque
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void atualizarProdutoRapido(produto.id, {
                              estoque: estoqueDisponivelProduto(produto) + 1,
                            })
                          }
                          disabled={
                            produtosSalvando.has(produto.id) ||
                            produto.id in estoquesEmEdicao
                          }
                          className="grid h-8 w-8 place-items-center rounded-md bg-zinc-800 text-lg hover:bg-zinc-700"
                          aria-label={`Aumentar estoque de ${produto.nome}`}
                        >
                          +
                        </button>
                        <span className="min-w-20 text-xs" aria-live="polite">
                          {produtosSalvando.has(produto.id) ? (
                            <span className="text-yellow-300">Salvando...</span>
                          ) : produtosSalvos.has(produto.id) ? (
                            <span className="text-green-300">Salvo no banco</span>
                          ) : (
                            <span className="text-zinc-500">
                              Digite e toque em salvar
                            </span>
                          )}
                        </span>
                      </form>
                    )}
                  </div>

                  {normalizarTexto(produto.nome).startsWith("combo ") &&
                    painelEstoqueComponentesCombo(produto)}

                  {produto.estoque_opcoes && (
                    <div className="mt-4 rounded-xl border border-zinc-700 bg-black/20 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-yellow-300">
                          Sabores e quantidades
                        </p>
                        {estoquesOpcoesSalvando.has(produto.id) && (
                          <span className="text-xs text-zinc-400">Salvando...</span>
                        )}
                      </div>
                      <div
                        className={`grid gap-2 ${
                          normalizarTexto(produto.nome).startsWith("essencia")
                            ? "lg:grid-cols-2"
                            : "sm:grid-cols-2 xl:grid-cols-3"
                        }`}
                      >
                        {Object.entries(produto.estoque_opcoes)
                          .sort(([saborA], [saborB]) =>
                            saborA.localeCompare(saborB, "pt-BR")
                          )
                          .map(([sabor, quantidade]) => {
                            const detalheSabor =
                              detalhesEssencias[produto.id]?.[sabor] ?? {};
                            const chaveDetalhe = `${produto.id}:${sabor}`;
                            const produtoEhEssencia = normalizarTexto(
                              produto.nome
                            ).startsWith("essencia");

                            return (
                              <div
                                key={sabor}
                                className="rounded-lg bg-zinc-800 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={sabor}>
                                    {sabor}
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void alterarEstoqueOpcao(produto, sabor, -1)
                                      }
                                      disabled={
                                        quantidade <= 0 ||
                                        estoquesOpcoesSalvando.has(produto.id)
                                      }
                                      className="grid h-7 w-7 place-items-center rounded bg-zinc-700 font-bold hover:bg-zinc-600 disabled:opacity-40"
                                      aria-label={`Diminuir estoque de ${sabor}`}
                                    >
                                      −
                                    </button>
                                    <strong className="w-7 text-center text-yellow-300">
                                      {quantidade}
                                    </strong>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void alterarEstoqueOpcao(produto, sabor, 1)
                                      }
                                      disabled={estoquesOpcoesSalvando.has(produto.id)}
                                      className="grid h-7 w-7 place-items-center rounded bg-zinc-700 font-bold hover:bg-zinc-600 disabled:opacity-40"
                                      aria-label={`Aumentar estoque de ${sabor}`}
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removerOpcaoEstoque(produto, sabor)
                                      }
                                      disabled={estoquesOpcoesSalvando.has(produto.id)}
                                      className="grid h-7 w-7 place-items-center rounded text-red-300 hover:bg-red-950 disabled:opacity-40"
                                      aria-label={`Remover sabor ${sabor}`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>

                                {produtoEhEssencia && (
                                  <div className="mt-3 grid grid-cols-[72px_1fr] gap-3 border-t border-zinc-700 pt-3">
                                    <div
                                      className="rounded-md outline-none focus:ring-2 focus:ring-yellow-400"
                                      onPaste={(event) => {
                                        event.stopPropagation();
                                        const foto = Array.from(
                                          event.clipboardData.items
                                        )
                                          .find(
                                            (item) =>
                                              item.kind === "file" &&
                                              item.type.startsWith("image/")
                                          )
                                          ?.getAsFile();
                                        if (!foto) return;
                                        event.preventDefault();
                                        void atualizarFotoSabor(
                                          produto,
                                          sabor,
                                          foto
                                        );
                                      }}
                                      tabIndex={0}
                                      role="group"
                                      aria-label={`Foto do sabor ${sabor}. Cole uma imagem com Control V.`}
                                    >
                                      {detalheSabor.imagem ? (
                                        <Image
                                          src={detalheSabor.imagem}
                                          alt={`${sabor} - ${produto.nome}`}
                                          width={72}
                                          height={72}
                                          className="aspect-square rounded-md bg-white object-contain p-1"
                                        />
                                      ) : (
                                        <div className="grid h-[72px] w-[72px] place-items-center rounded-md bg-zinc-700 px-1 text-center text-[10px] text-zinc-400">
                                          Sem foto
                                        </div>
                                      )}
                                      <label
                                        className={`mt-1 block cursor-pointer rounded border border-zinc-600 px-1 py-1 text-center text-[10px] font-semibold hover:bg-zinc-700 ${
                                          detalhesSaboresSalvando.has(chaveDetalhe)
                                            ? "pointer-events-none opacity-50"
                                            : ""
                                        }`}
                                      >
                                        {detalheSabor.imagem ? "Trocar foto" : "Adicionar foto"}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          disabled={detalhesSaboresSalvando.has(chaveDetalhe)}
                                          onChange={(event) => {
                                            const foto = event.target.files?.[0];
                                            event.target.value = "";
                                            if (foto) {
                                              void atualizarFotoSabor(
                                                produto,
                                                sabor,
                                                foto
                                              );
                                            }
                                          }}
                                          className="sr-only"
                                          aria-label={`Foto do sabor ${sabor}`}
                                        />
                                      </label>
                                      <p className="mt-1 text-center text-[9px] text-zinc-500">
                                        ou Ctrl+V
                                      </p>
                                    </div>
                                    <label className="flex min-w-0 flex-col gap-1 text-xs">
                                      <span className="font-semibold text-zinc-300">
                                        Descrição do sabor
                                      </span>
                                      <textarea
                                        defaultValue={detalheSabor.descricao ?? ""}
                                        placeholder="Ex.: sabor refrescante e frutado"
                                        onBlur={(event) => {
                                          const descricaoSabor =
                                            event.target.value.trim();
                                          if (
                                            descricaoSabor !==
                                            (detalheSabor.descricao ?? "")
                                          ) {
                                            void salvarDetalheSabor(
                                              produto.id,
                                              sabor,
                                              { descricao: descricaoSabor }
                                            );
                                          }
                                        }}
                                        className="min-h-[72px] w-full resize-y rounded-md bg-zinc-900 px-2 py-2 text-xs text-zinc-200"
                                        aria-label={`Descrição do sabor ${sabor}`}
                                      />
                                      {detalhesSaboresSalvando.has(chaveDetalhe) && (
                                        <span className="text-zinc-400">Salvando...</span>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={novosSabores[produto.id] ?? ""}
                          onChange={(event) =>
                            setNovosSabores((atuais) => ({
                              ...atuais,
                              [produto.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void adicionarOpcaoEstoque(produto);
                            }
                          }}
                          placeholder="Adicionar novo sabor"
                          className="min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm"
                          aria-label={`Novo sabor de ${produto.nome}`}
                        />
                        <button
                          type="button"
                          onClick={() => void adicionarOpcaoEstoque(produto)}
                          disabled={
                            !(novosSabores[produto.id] ?? "").trim() ||
                            estoquesOpcoesSalvando.has(produto.id)
                          }
                          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
                        >
                          Adicionar sabor
                        </button>
                      </div>
                    </div>
                  )}

                  {produto.destaque && (
                    <span className="inline-block mt-2 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold">
                      Destaque
                    </span>
                  )}

                </div>

              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => editarProduto(produto)}
                  className="bg-yellow-400 px-6 py-3 rounded-lg font-semibold text-black transition hover:bg-yellow-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => excluirProduto(produto.id)}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Excluir
                </button>
              </div>

            </div>
          ))}
        </div>

        <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-xl p-6">

          <h2 className="text-2xl font-bold mb-4">
            Resumo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Produtos
              </p>

              <p className="text-3xl font-bold">
                {produtos.length}
              </p>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Categorias
              </p>

              <p className="text-3xl font-bold">
                {categorias.length}
              </p>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Destaques
              </p>

              <p className="text-3xl font-bold">
                {
                  produtos.filter(
                    (produto) => produto.destaque
                  ).length
                }
              </p>
            </div>

          </div>

        </div>
          </>
        )}

      </div>

    </main>
  );
}
