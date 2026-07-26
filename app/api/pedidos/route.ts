import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ItemRecebido = {
  produto_id?: unknown;
  quantidade?: unknown;
  escolhas_combo?: unknown;
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
  const cidadeEntrega =
    body?.cidade_entrega === "Paranacity" ||
    body?.cidade_entrega === "Cruzeiro do Sul"
      ? body.cidade_entrega
      : "";

  if (
    typeof body?.cliente_nome !== "string" ||
    typeof body?.telefone !== "string" ||
    typeof body?.endereco !== "string" ||
    !body.cliente_nome.trim() ||
    !body.telefone.trim() ||
    !body.endereco.trim() ||
    !cidadeEntrega ||
    !Array.isArray(body?.pagamento) ||
    body.pagamento.length < 1 ||
    itens.length === 0 ||
    itens.length > 50
  ) {
    return NextResponse.json({ error: "Dados do pedido inválidos." }, { status: 400 });
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
        .select("id,nome,preco,categoria_id,tipo_venda,disponivel")
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

  const valorTotal = itensValidados.reduce(
    (total, item) => total + item.subtotal,
    0
  );
  const itensTabacaria = itensValidados.filter(
    (item) => item.categoria === "tabacaria"
  );
  const somenteTabacaria =
    itensTabacaria.length > 0 &&
    itensTabacaria.length === itensValidados.length;
  const pedidoMinimo = somenteTabacaria
    ? 20
    : cidadeEntrega === "Paranacity"
      ? 25
      : 35;

  if (valorTotal < pedidoMinimo) {
    return NextResponse.json(
      {
        error: `O pedido mínimo para entrega em ${cidadeEntrega} é de R$ ${pedidoMinimo.toFixed(2).replace(".", ",")}.`,
      },
      { status: 400 }
    );
  }

  const temCombo = itensValidados.some(
    (item) => item.categoria === "combos"
  );
  const temCaixaFechada = itensValidados.some(
    (item) =>
      item.categoria === "cervejas" && item.produto.tipo_venda !== "avulso"
  );
  const subtotalTabacaria = itensTabacaria.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  if (
    itensTabacaria.length > 0 &&
    !temCombo &&
    !temCaixaFechada &&
    subtotalTabacaria < 20
  ) {
    return NextResponse.json(
      { error: "O pedido mínimo para itens da Tabacaria é de R$ 20,00." },
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
    p_endereco: body.endereco,
    p_referencia: typeof body.referencia === "string" ? body.referencia : "",
    p_itens: itens,
    p_pagamento: Array.isArray(body.pagamento) ? body.pagamento.slice(0, 2) : [],
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

  return NextResponse.json({ id: pedidoId }, { status: 201 });
}
