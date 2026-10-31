// Execução externa, somente leitura. Não cria pedidos nem modifica o banco.
import { alertaConfigurado, enviarAlerta } from '../lib/enviar-alerta.mjs';
const { MONITOR_BASE_URL, MONITOR_TOKEN } = process.env;
if (!MONITOR_BASE_URL?.startsWith("https://") || !MONITOR_TOKEN || !alertaConfigurado()) throw new Error("Configure o endereço, token e destino de alertas do monitor.");
async function verificar() {
  const saude = await fetch(new URL("/api/saude", MONITOR_BASE_URL), { headers: { Authorization: "Bearer " + MONITOR_TOKEN }, signal: AbortSignal.timeout(25_000) });
  if (!saude.ok) throw new Error("saude_indisponivel");
  const dados = await saude.json();
  const catalogo = await fetch(MONITOR_BASE_URL, { signal: AbortSignal.timeout(25_000) });
  const html = await catalogo.text();
  if (!catalogo.ok || !html.includes("Guetto") || html.includes("Não conseguimos abrir esta tela")) throw new Error("catalogo_indisponivel");
  return dados;
}
async function alertar(evento) {
  await enviarAlerta(evento);
}
let dados;
try { dados = await verificar(); } catch {
  await new Promise(resolve => setTimeout(resolve, 5_000));
  try { dados = await verificar(); } catch {
    await alertar("catalogo_ou_api_indisponivel_em_duas_verificacoes");
    process.exitCode = 1;
  }
}
if (dados?.pedidosAguardando > 0) await alertar("pedido_novo_aguardando_mais_de_5_minutos");
