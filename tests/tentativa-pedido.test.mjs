import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../lib/tentativa-pedido.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { obterTentativaPedido, limparTentativaPedido, iniciarTentativaNovaCompra } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const storage = () => {
  const valores = new Map();
  return { getItem: chave => valores.get(chave) ?? null, setItem: (chave, valor) => valores.set(chave, valor), removeItem: chave => valores.delete(chave) };
};

test("refazer compra idêntica abandona confirmação antiga e preserva retries da nova compra", async () => {
  const local = storage();
  const corpo = JSON.stringify({ itens: [{ id: "produto", quantidade: 2 }] });
  const antiga = await obterTentativaPedido(corpo, null, local);
  local.setItem("guetto_mensagem_pendente", "confirmacao-antiga");
  local.setItem("guetto_historico_pedidos", "historico-preservado");
  const nova = iniciarTentativaNovaCompra(local);
  assert.notEqual(nova.chave, antiga.chave);
  assert.equal(local.getItem("guetto_mensagem_pendente"), null);
  assert.equal(local.getItem("guetto_historico_pedidos"), "historico-preservado");
  const envio = await obterTentativaPedido(corpo, null, local);
  assert.equal(envio.chave, nova.chave);
  assert.equal((await obterTentativaPedido(corpo, envio, local)).chave, nova.chave);
  assert.equal((await obterTentativaPedido(corpo, null, local)).chave, nova.chave);
});

test("repetição após falha e recarga preserva a tentativa sem guardar dados pessoais", async () => {
  const local = storage();
  const corpo = JSON.stringify({ cliente_nome: "Cliente de teste", itens: [{ produto_id: "teste", quantidade: 1 }] });
  const primeira = await obterTentativaPedido(corpo, null, local);
  assert.deepEqual(await obterTentativaPedido(corpo, null, local), primeira);
  assert.ok(!local.getItem("guetto_tentativa_pedido").includes("Cliente de teste"));
});
test("alterar dados após uma falha mantém a chave e impede duplicação", async () => {
  const local = storage();
  const primeira = await obterTentativaPedido('{"quantidade":1}', null, local);
  const alterada = await obterTentativaPedido('{"quantidade":2}', primeira, local);
  assert.equal(primeira.chave, alterada.chave);
  assert.notEqual(primeira.assinatura, alterada.assinatura);
});
test("armazenamento bloqueado mantém proteção em memória", async () => {
  const bloqueado = { getItem() { throw Error("Bloqueado"); }, setItem() { throw Error("Bloqueado"); } };
  const primeira = await obterTentativaPedido("pedido", null, bloqueado);
  assert.deepEqual(await obterTentativaPedido("pedido", primeira, bloqueado), primeira);
});
test("confirmar libera nova compra igual e preserva outra tentativa em andamento", async () => {
  const local = storage();
  const primeira = await obterTentativaPedido("pedido", null, local);
  limparTentativaPedido(primeira.chave, local);
  const segunda = await obterTentativaPedido("pedido", null, local);
  assert.notEqual(primeira.chave, segunda.chave);
  limparTentativaPedido(primeira.chave, local);
  assert.equal((await obterTentativaPedido("pedido", null, local)).chave, segunda.chave);
});
