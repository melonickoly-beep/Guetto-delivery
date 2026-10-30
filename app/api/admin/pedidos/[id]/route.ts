import { alertarErroCritico } from "@/lib/alertas";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";
import { removerPedidoDoResumo } from "@/lib/resumo-sorteio";

const STATUS_VALIDOS = [
  "novo",
  "em_preparo",
  "saiu_para_entrega",
  "concluido",
  "cancelado",
] as const;

async function executarPATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await obterAdministrador())) {
    alertarErroCritico("admin_acesso_negado", 401);
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

  if (body.status === "cancelado") {
    try {
      await removerPedidoDoResumo(id);
    } catch (erroResumo) {
      console.error("Pedido cancelado, mas permaneceu no resumo do sorteio:", erroResumo);
    }
  }

  return NextResponse.json({ sucesso: true });
}

async function executarDELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await obterAdministrador())) {
    alertarErroCritico("admin_acesso_negado", 401);
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

  try {
    await removerPedidoDoResumo(id);
  } catch (erroResumo) {
    console.error("Erro ao remover pedido do resumo do sorteio:", erroResumo);
    return NextResponse.json(
      { error: "Não foi possível remover o pedido do resumo do sorteio." },
      { status: 500 }
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

export async function PATCH(...args: Parameters<typeof executarPATCH>) {
  try {
    const resposta = await executarPATCH(...args);
    if (resposta.status >= 500) alertarErroCritico("painel_patch", resposta.status);
    return resposta;
  } catch {
    alertarErroCritico("painel_patch_excecao");
    return NextResponse.json({ error: "Não foi possível confirmar a operação. Atualize ou tente novamente com os mesmos dados." }, { status: 503 });
  }
}

export async function DELETE(...args: Parameters<typeof executarDELETE>) {
  try {
    const resposta = await executarDELETE(...args);
    if (resposta.status >= 500) alertarErroCritico("painel_delete", resposta.status);
    return resposta;
  } catch {
    alertarErroCritico("painel_delete_excecao");
    return NextResponse.json({ error: "Não foi possível confirmar a operação. Atualize ou tente novamente com os mesmos dados." }, { status: 503 });
  }
}
