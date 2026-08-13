import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  avaliarPedidoMinimo,
  avaliarPedidoMinimoLongNeck,
  ehCidadeEntrega,
  mensagemPedidoMinimo,
  mensagemPedidoMinimoLongNeck,
  type CidadeEntrega,
} from "@/lib/pedido-minimo";
import { registrarPedidoNoResumo } from "@/lib/resumo-sorteio";

type ItemRecebido = {
  produto_id?: unknown;
  quantidade?: unknown;
  escolhas_combo?: unknown;
};

type TrocoRecebido = {
  precisa_troco?: unknown;
  troco_para?: unknown;
};

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itens: ItemRecebido[] = Array.isArray(body?.itens) ? body.itens : [];
  const tipoAtendimento =
    body?.tipo_atendimento === undefined
      ? "delivery"
      : body?.tipo_atendimento === "delivery" ||
          body?.tipo_atendimento === "retirada"
        ? body.tipo_atendimento
        : "";
  const tercaFeira =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    }).format(new Date()) === "Tue";
  const { data: configuracaoRetirada, error: erroConfiguracaoRetirada } =
    await supabaseAdmin
      .from("configuracoes")
      .select("valor")
      .eq("chave", "somente_retirada")
      .maybeSingle();

  if (erroConfiguracaoRetirada) {
    return NextResponse.json(
      { error: "Não foi possível verificar o tipo de atendimento." },
      { status: 503 }
    );
  }

  const somenteRetiradaHoje =
    tercaFeira || configuracaoRetirada?.valor === "true";

  if (!tipoAtendimento) {
    return NextResponse.json(
      { error: "Tipo de atendimento inválido." },
      { status: 400 }
    );
  }

  if (somenteRetiradaHoje) {
    return NextResponse.json(
      {
        error:
          "Hoje o site está disponível apenas para consulta. As compras devem ser feitas presencialmente na loja.",
      },
      { status: 403 }
    );
  }

  if (!somenteRetiradaHoje && tipoAtendimento !== "delivery") {
    return NextResponse.json(
      { error: "Atualize a página para conferir o atendimento disponível." },
      { status: 409 }
    );
  }

  const cidadeEntrega = ehCidadeEntrega(body?.cidade_entrega)
    ? body.cidade_entrega
    : "";
  const endereco =
    typeof body?.endereco === "string" ? body.endereco.trim() : "";
  const bairro = typeof body?.bairro === "string" ? body.bairro.trim() : "";

  if (!bairro || bairro.length > 100) {
    return NextResponse.json(
      { error: "Informe o bairro para continuar." },
      { status: 400 }
    );
  }

  if (
    typeof body?.cliente_nome !== "string" ||
    typeof body?.telefone !== "string" ||
    !body.cliente_nome.trim() ||
    !body.telefone.trim() ||
    !endereco ||
    !cidadeEntrega ||
    !Array.isArray(body?.pagamento) ||
    body.pagamento.length < 1 ||
    body.pagamento.length > 3 ||
    body.pagamento.some(
      (pagamento: unknown) =>
        typeof pagamento !== "string" || !pagamento.trim()
    ) ||
    itens.length === 0 ||
    itens.length > 50
  ) {
    return NextResponse.json({ error: "Dados do pedido inválidos." }, { status: 400 });
  }

  const troco: Array<TrocoRecebido | null> = Array.isArray(body?.troco)
    ? body.troco
    : [];
  const pagamentoEmDinheiroInvalido = body.pagamento.some(
    (pagamento: string, indice: number) => {
      const pagamentoNormalizado = normalizar(pagamento);
      if (!pagamentoNormalizado.startsWith("dinheiro:")) return false;

      const confirmacao = troco[indice];
      if (
        !confirmacao ||
        typeof confirmacao.precisa_troco !== "boolean"
      ) {
        return true;
      }

      return (
        confirmacao.precisa_troco &&
        (typeof confirmacao.troco_para !== "number" ||
          !Number.isFinite(confirmacao.troco_para) ||
          confirmacao.troco_para <= 0)
      );
    }
  );

  if (pagamentoEmDinheiroInvalido) {
    return NextResponse.json(
      {
        error:
          "Informe se vai precisar de troco ou não e, quando necessário, o valor para o troco.",
      },
      { status: 400 }
    );
  }

  for (const item of itens) {
    const id = typeof item.produto_id === "string" ? item.produto_id : "";
    const quantidade = Number(item.quantidade);
    if (!id || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
      return NextResponse.json({ error: "Item do pedido inválido." }, { status: 400 });
    }
  }

  const idsProdutos = [
    ...new Set(
      itens.map((item) =>
        typeof item.produto_id === "string" ? item.produto_id : ""
      )
    ),
  ].filter(Boolean);
  const [{ data: produtos, error: erroProdutos }, { data: categorias, error: erroCategorias }] =
    await Promise.all([
      supabaseAdmin
        .from("produtos")
        .select(
          "id,nome,descricao,preco,categoria_id,disponivel,tipo_venda"
        )
        .in("id", idsProdutos),
      supabaseAdmin.from("categorias").select("id,nome"),
    ]);

  if (erroProdutos || erroCategorias) {
    return NextResponse.json(
      { error: "Não foi possível validar o pedido." },
      { status: 500 }
    );
  }

  const produtosPorId = new Map(
    (produtos ?? []).map((produto) => [produto.id, produto])
  );
  const categoriasPorId = new Map(
    (categorias ?? []).map((categoria) => [
      categoria.id,
      normalizar(categoria.nome),
    ])
  );
  const itensValidados = itens.flatMap((item) => {
    const produto =
      typeof item.produto_id === "string"
        ? produtosPorId.get(item.produto_id)
        : undefined;
    if (!produto || !produto.disponivel) return [];

    const quantidade = Number(item.quantidade);
    const subtotal =
      normalizar(produto.nome) === "seda zomo"
        ? Math.floor(quantidade / 3) * 10 +
          (quantidade % 3) * Number(produto.preco)
        : quantidade * Number(produto.preco);

    return [
      {
        produto,
        quantidade,
        subtotal,
        categoria: categoriasPorId.get(produto.categoria_id) ?? "",
      },
    ];
  });

  if (itensValidados.length !== itens.length) {
    return NextResponse.json(
      { error: "Um ou mais produtos não estão disponíveis." },
      { status: 409 }
    );
  }

  const itensParaPedidoMinimo = itensValidados.map((item) => ({
    categoria: item.categoria,
    tipoVenda: item.produto.tipo_venda,
    nome: item.produto.nome,
    descricao: item.produto.descricao,
    subtotal: item.subtotal,
    quantidade: item.quantidade,
  }));
  const avaliacaoPedidoMinimo = avaliarPedidoMinimo(
    itensParaPedidoMinimo,
    cidadeEntrega as CidadeEntrega
  );

  if (!avaliacaoPedidoMinimo.atingido) {
    return NextResponse.json(
      {
        error: mensagemPedidoMinimo(
          avaliacaoPedidoMinimo,
          cidadeEntrega as CidadeEntrega
        ),
      },
      { status: 400 }
    );
  }

  const avaliacaoPedidoMinimoLongNeck = avaliarPedidoMinimoLongNeck(
    itensParaPedidoMinimo,
    cidadeEntrega as CidadeEntrega
  );

  if (!avaliacaoPedidoMinimoLongNeck.atingido) {
    return NextResponse.json(
      {
        error: mensagemPedidoMinimoLongNeck(avaliacaoPedidoMinimoLongNeck),
      },
      { status: 400 }
    );
  }

  const quantidadeGarrafas300 = itensValidados
    .filter((item) => normalizar(item.produto.nome).includes("garrafa 300ml"))
    .reduce((total, item) => total + item.quantidade, 0);

  if (quantidadeGarrafas300 > 0 && quantidadeGarrafas300 < 10) {
    return NextResponse.json(
      {
        error:
          "O pedido mínimo para cervejas em garrafa de 300 ml é de 10 unidades.",
      },
      { status: 400 }
    );
  }

  if (quantidadeGarrafas300 > 0 && body?.vasilhame_confirmado !== true) {
    return NextResponse.json(
      {
        error:
          "Confirme que o vasilhame é obrigatório e não está incluso no pedido.",
      },
      { status: 400 }
    );
  }

  const { data: pedidoId, error } = await supabaseAdmin.rpc("criar_pedido_seguro", {
    p_cliente_nome: body.cliente_nome,
    p_telefone: body.telefone,
    p_endereco: `${endereco} — Bairro: ${bairro}`,
    p_referencia: typeof body.referencia === "string" ? body.referencia : "",
    p_itens: itens,
    p_pagamento: Array.isArray(body.pagamento) ? body.pagamento.slice(0, 3) : [],
    p_tempo_entrega: Number(body.tempo_entrega) || 20,
    p_observacao: typeof body.observacao === "string" ? body.observacao : "",
  });

  if (error) {
    const conflito = /estoque insuficiente|produto indisponível/i.test(error.message);
    return NextResponse.json(
      { error: conflito ? error.message : "Não foi possível registrar o pedido." },
      { status: conflito ? 409 : 500 }
    );
  }

  try {
    await registrarPedidoNoResumo(String(pedidoId));
  } catch (erroResumo) {
    console.error("Pedido criado, mas não entrou no resumo do sorteio:", erroResumo);
  }

  return NextResponse.json({ id: pedidoId }, { status: 201 });
}
