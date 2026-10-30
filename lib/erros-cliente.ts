import { normalizarDiagnostico, type TipoErro } from "./diagnostico-cliente";
const enviados = new Map<string, number>();
export function registrarErroCliente(tipo: TipoErro, erro?: unknown, status?: number) {
  try {
    if (typeof window === "undefined" || location.pathname === "/login") return;
    const ua = navigator.userAgent;
    const e = erro instanceof Error ? erro : undefined;
    const dados = normalizarDiagnostico({
      tipo, status,
      pagina: location.pathname.startsWith("/acompanhar/") ? "/acompanhar" : location.pathname,
      navegador: /SamsungBrowser/.test(ua) ? "Samsung" : /Edg/.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "outro",
      sistema: /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : "outro",
      erro: e?.name,
      codigo: (e as (Error & { digest?: string }) | undefined)?.digest,
      local: e?.stack?.match(/\/_next\/static\/[a-zA-Z0-9_./-]+\.js:\d+:\d+/)?.[0],
    });
    const corpo = JSON.stringify(dados);
    if (Date.now() - (enviados.get(corpo) ?? 0) < 60_000) return;
    if (enviados.size >= 100) enviados.clear();
    enviados.set(corpo, Date.now());
    void fetch("/api/erros-cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, credentials: "omit", keepalive: true }).catch(() => undefined);
  } catch { /* O diagnóstico nunca pode impedir a compra. */ }
}
