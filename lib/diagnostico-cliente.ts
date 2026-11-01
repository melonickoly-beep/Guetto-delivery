export const TIPOS_ERRO = ["javascript", "promessa", "tela", "pedido_http", "pedido_rede", "recurso", "recurso_critico", "catalogo", "painel"] as const;
export type TipoErro = typeof TIPOS_ERRO[number];
export function normalizarDiagnostico(valor: unknown) {
  if (!valor || typeof valor !== "object") return null;
  const d = valor as Record<string, unknown>;
  if (!TIPOS_ERRO.includes(d.tipo as TipoErro)) return null;
  const permitido = (v: unknown, lista: string[]) => typeof v === "string" && lista.includes(v) ? v : "outro";
  return {
    tipo: d.tipo as TipoErro,
    pagina: permitido(d.pagina, ["/", "/historico", "/acompanhar", "/privacidade"]),
    navegador: permitido(d.navegador, ["Chrome", "Safari", "Firefox", "Edge", "Samsung"]),
    sistema: permitido(d.sistema, ["Android", "iOS", "Windows", "outro"]),
    erro: permitido(d.erro, ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "SecurityError", "QuotaExceededError", "ChunkLoadError", "Error"]),
    status: typeof d.status === "number" && Number.isInteger(d.status) && d.status >= 400 && d.status <= 599 ? d.status : null,
    codigo: typeof d.codigo === "string" && /^\d{1,20}$/.test(d.codigo) ? d.codigo : null,
    local: typeof d.local === "string" && /^\/_next\/static\/[a-zA-Z0-9_./-]+\.js:\d{1,7}:\d{1,7}$/.test(d.local) && d.local.length < 200 ? d.local : null,
  };
}
