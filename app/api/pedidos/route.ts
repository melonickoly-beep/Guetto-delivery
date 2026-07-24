import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ItemRecebido = {
  produto_id?: unknown;
  quantidade?: unknown;
  escolhas_combo?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itens: ItemRecebido[] = Array.isArray(body?.itens) ? body.itens : [];

  if (
    typeof body?.cliente_nome !== "string" ||
    typeof body?.telefone !== "string" ||
    typeof body?.endereco !== "string" ||
    !body.cliente_nome.trim() ||
    !body.telefone.trim() ||
    !body.endereco.trim() ||
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
