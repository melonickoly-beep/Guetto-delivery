import { timingSafeEqual } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { siteEmManutencao } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const esperado = process.env.MONITOR_TOKEN;
  const recebido = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!esperado || Buffer.byteLength(esperado) !== Buffer.byteLength(recebido) ||
      !timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido))) return new Response(null, { status: 401 });
  try {
    const [produtos, categorias, configuracoes, pedidos] = await Promise.all([
      supabase.from("produtos").select("id").eq("disponivel", true).limit(1),
      supabase.from("categorias").select("id").limit(1),
      supabase.from("configuracoes").select("chave,valor").in("chave", ["somente_retirada", "horario_abertura", "horario_fechamento"]),
      supabaseAdmin.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "novo").lt("created_at", new Date(Date.now() - 300_000).toISOString()),
    ]);
    if (produtos.error || categorias.error || configuracoes.error || pedidos.error || !produtos.data?.length || !categorias.data?.length) {
      return Response.json({ saudavel: false, codigo: "consulta_indisponivel" }, { status: 503 });
    }
    const config = new Map(configuracoes.data?.map(item => [item.chave, item.valor]));
    const agora = new Date();
    const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(agora);
    const horario = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(agora);
    const abertura = config.get("horario_abertura");
    const fechamento = config.get("horario_fechamento");
    const emHorario = abertura && fechamento && (abertura <= fechamento ? horario >= abertura && horario < fechamento : horario >= abertura || horario < fechamento);
    const atendendo = Boolean(emHorario && dia !== "Tue" && config.get("somente_retirada") !== "true" && !siteEmManutencao());
    return Response.json({ saudavel: true, pedidosAguardando: atendendo ? pedidos.count ?? 0 : 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ saudavel: false, codigo: "consulta_falhou" }, { status: 503 }); }
}
