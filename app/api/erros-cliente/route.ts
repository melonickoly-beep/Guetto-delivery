import { alertarErroCritico } from "@/lib/alertas";
import { normalizarDiagnostico } from "@/lib/diagnostico-cliente";
let inicio = 0;
let recebidos = 0;
export async function POST(request: Request) {
  const origem = request.headers.get("origin");
  if (!origem || origem !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Date.now() - inicio > 60_000) { inicio = Date.now(); recebidos = 0; }
  if (++recebidos > 100) return new Response(null, { status: 429 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let tamanho = 0;
  let texto = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > 2048) { await reader.cancel(); return new Response(null, { status: 413 }); }
      texto += decoder.decode(value, { stream: true });
    }
    texto += decoder.decode();
    const dados = normalizarDiagnostico(JSON.parse(texto));
    if (!dados) return new Response(null, { status: 400 });
    alertarErroCritico("cliente_" + dados.tipo, dados.status ?? 500);
    console.error(JSON.stringify({ evento: "erro_cliente", horario: new Date().toISOString(), ...dados }));
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 400 }); }
}
