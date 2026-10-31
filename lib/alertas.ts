import { after } from "next/server";
import { alertaConfigurado, enviarAlerta } from "./enviar-alerta.mjs";
const ultimos = new Map<string, number>();
// Somente códigos e status: nunca envia nomes, telefones, endereço ou mensagens de erro.
export function alertarErroCritico(evento: string, status = 500) {
  const codigo = evento.replace(/[^a-z0-9_]/gi, "").slice(0, 80);
  console.error(JSON.stringify({ evento: codigo, status, horario: new Date().toISOString() }));
  if (!alertaConfigurado()) return;
  const chave = codigo + status;
  if (Date.now() - (ultimos.get(chave) ?? 0) < 60_000) return;
  if (ultimos.size > 200) ultimos.clear();
  ultimos.set(chave, Date.now());
  after(async () => {
    try {
      await enviarAlerta(codigo, status);
    } catch { console.error("Falha na entrega do alerta crítico"); }
  });
}
