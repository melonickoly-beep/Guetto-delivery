import { after } from "next/server";
const ultimos = new Map<string, number>();
// Somente códigos e status: nunca envia nomes, telefones, endereço ou mensagens de erro.
export function alertarErroCritico(evento: string, status = 500) {
  const codigo = evento.replace(/[^a-z0-9_]/gi, "").slice(0, 80);
  console.error(JSON.stringify({ evento: codigo, status, horario: new Date().toISOString() }));
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || !url.startsWith("https://")) return;
  const chave = codigo + status;
  if (Date.now() - (ultimos.get(chave) ?? 0) < 60_000) return;
  if (ultimos.size > 200) ultimos.clear();
  ultimos.set(chave, Date.now());
  after(async () => {
    try {
      const resposta = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Guetto Delivery: " + codigo + " (" + status + ")", evento: codigo, status }),
        signal: AbortSignal.timeout(5_000), redirect: "error",
      });
      if (!resposta.ok) throw new Error("webhook");
    } catch { console.error("Falha na entrega do alerta crítico"); }
  });
}
