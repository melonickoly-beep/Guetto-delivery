import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
function modulo(path, transformar = s => s) {
  const source = transformar(readFileSync(new URL(path, import.meta.url), "utf8"));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { administradorAutorizado } = await modulo("../lib/admin-autorizado.ts");
const { fetchComTimeout } = await modulo("../lib/rede.ts");
test("admin: configuração ausente e outra identidade são negadas", () => {
  const user = { id: "admin-uuid", email: "admin@loja.test" };
  assert.equal(administradorAutorizado(user), false);
  assert.equal(administradorAutorizado(user, "admin-uuid"), false);
  assert.equal(administradorAutorizado(user, "outro", user.email), false);
  assert.equal(administradorAutorizado({ ...user, email: "outra@loja.test" }, user.id, user.email), false);
  assert.equal(administradorAutorizado(null, user.id, user.email), false);
  assert.equal(administradorAutorizado(user, user.id, " ADMIN@LOJA.TEST "), true);
});
test("timeout aborta resposta lenta sem repetir o POST", async () => {
  const original = globalThis.fetch; let chamadas = 0;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    chamadas++;
    signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")));
  });
  try {
    await assert.rejects(fetchComTimeout("https://local.test", { method: "POST" }, 15), { name: "AbortError" });
    assert.equal(chamadas, 1);
  } finally { globalThis.fetch = original; }
});
test("timeout cobre corpo lento e mantém resposta de conflito sem repetir", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, { signal }) => new Response(new ReadableStream({ start(controller) {
      signal.addEventListener("abort", () => controller.error(new DOMException("Timeout", "AbortError")));
    } }));
    await assert.rejects(fetchComTimeout("https://local.test", {}, 15), { name: "AbortError" });
    globalThis.fetch = async () => Response.json({ error: "preço mudou" }, { status: 409 });
    const resposta = await fetchComTimeout("https://local.test");
    assert.equal(resposta.status, 409);
    assert.deepEqual(await resposta.json(), { error: "preço mudou" });
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal((await fetchComTimeout("https://local.test")).status, 204);
  } finally { globalThis.fetch = original; }
});
test("alerta é sanitizado, deduplicado e falha do webhook não afeta a operação", async () => {
  const tarefas = []; globalThis.__tarefasAlertas = tarefas;
  const { alertarErroCritico } = await modulo("../lib/alertas.ts", s => s.replace('import { after } from "next/server";', 'const after = tarefa => globalThis.__tarefasAlertas.push(tarefa);'));
  const originalFetch = globalThis.fetch; const originalConsole = console.error;
  const originalUrl = process.env.ALERT_WEBHOOK_URL; const logs = []; const enviados = [];
  console.error = v => logs.push(v);
  process.env.ALERT_WEBHOOK_URL = "https://alertas.test/webhook";
  globalThis.fetch = async (_url, init) => { enviados.push(JSON.parse(init.body)); return new Response(null, { status: 503 }); };
  try {
    alertarErroCritico("pedido_falhou", 503); alertarErroCritico("pedido_falhou", 503);
    assert.equal(tarefas.length, 1); await tarefas[0]();
    assert.equal(enviados.length, 1); assert.equal(enviados[0].evento, "pedido_falhou");
    assert.ok(logs.includes("Falha na entrega do alerta crítico"));
  } finally {
    globalThis.fetch = originalFetch; console.error = originalConsole;
    if (originalUrl === undefined) delete process.env.ALERT_WEBHOOK_URL; else process.env.ALERT_WEBHOOK_URL = originalUrl;
    delete globalThis.__tarefasAlertas;
  }
});
