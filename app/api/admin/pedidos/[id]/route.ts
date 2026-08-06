import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";

const STATUS_VALIDOS = [
  "novo",
  "em_preparo",
  "saiu_para_entrega",
  "concluido",
  "cancelado",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!STATUS_VALIDOS.includes(body?.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc(
    "atualizar_status_pedido_seguro",
    {
      p_pedido_id: id,
      p_status: body.status,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Não foi possível atualizar o pedido." },
      { status: 500 }
    );
  }

  return NextResponse.json({ sucesso: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const { data: pedido, error: erroBusca } = await supabaseAdmin
    .from("pedidos")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();

  if (erroBusca) {
    return NextResponse.json(
      { error: erroBusca.message || "Não foi possível localizar o pedido." },
      { status: 500 }
    );
  }

  if (!pedido) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (pedido.status !== "cancelado") {
    return NextResponse.json(
      { error: "Apenas pedidos cancelados podem ser excluídos." },
      { status: 400 }
    );
  }

  const { error: erroExclusao } = await supabaseAdmin
    .from("pedidos")
    .delete()
    .eq("id", id)
    .eq("status", "cancelado");

  if (erroExclusao) {
    return NextResponse.json(
      { error: erroExclusao.message || "Não foi possível excluir o pedido." },
      { status: 500 }
    );
  }

  return NextResponse.json({ sucesso: true });
}
