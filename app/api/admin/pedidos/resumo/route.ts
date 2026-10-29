import { alertarErroCritico } from "@/lib/alertas";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";

type ResumoPedidosHoje = {
  data_referencia: string;
  pedidos_ativos: number | string;
  pedidos_concluidos: number | string;
  pedidos_total: number | string;
};

async function executarGET() {
  if (!(await obterAdministrador())) {
    alertarErroCritico("admin_acesso_negado", 401);
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

export async function GET(...args: Parameters<typeof executarGET>) {
  try {
    const resposta = await executarGET(...args);
    if (resposta.status >= 500) alertarErroCritico("painel_get", resposta.status);
    return resposta;
  } catch {
    alertarErroCritico("painel_get_excecao");
    return NextResponse.json({ error: "Não foi possível confirmar a operação. Atualize ou tente novamente com os mesmos dados." }, { status: 503 });
  }
}
