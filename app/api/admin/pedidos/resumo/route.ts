import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";

type ResumoPedidosHoje = {
  data_referencia: string;
  pedidos_ativos: number | string;
  pedidos_concluidos: number | string;
  pedidos_total: number | string;
};

export async function GET() {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc(
    "obter_resumo_pedidos_hoje"
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Não foi possível carregar a contagem." },
      { status: 500 }
    );
  }

  const resumo = (Array.isArray(data) ? data[0] : data) as
    | ResumoPedidosHoje
    | null;

  return NextResponse.json({
    data: resumo?.data_referencia ?? null,
    ativos: Number(resumo?.pedidos_ativos ?? 0),
    concluidos: Number(resumo?.pedidos_concluidos ?? 0),
    total: Number(resumo?.pedidos_total ?? 0),
  });
}
