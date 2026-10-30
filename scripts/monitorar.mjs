// Execução externa, somente leitura. Não cria pedidos nem modifica o banco.
const { MONITOR_BASE_URL, MONITOR_TOKEN, ALERT_WEBHOOK_URL } = process.env;
if (!MONITOR_BASE_URL?.startsWith("https://") || !MONITOR_TOKEN || !ALERT_WEBHOOK_URL?.startsWith("https://")) throw new Error("Configure as três variáveis do monitor.");
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
  const resposta = await fetch(ALERT_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Guetto Delivery: " + evento }), signal: AbortSignal.timeout(5_000), redirect: "error" });
  if (!resposta.ok) throw new Error("Entrega do alerta falhou");
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
