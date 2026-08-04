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
