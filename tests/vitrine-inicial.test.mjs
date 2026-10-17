import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../lib/vitrine-inicial.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { selecionarVitrineInicial } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const produtos = Array.from({ length: 40 }, (_, indice) => ({
  id: String(indice), destaque: false, mais_vendido: true, posicao_mais_vendido: indice + 1, estoque: 1,
}));

test("exibe no máximo 24 produtos mantendo a ordem dos mais vendidos", () => {
  const vitrine = selecionarVitrineInicial([...produtos].reverse(), p => p.estoque);
  assert.deepEqual(vitrine.map(p => p.id), produtos.slice(0, 24).map(p => p.id));
});
test("esgotados não ocupam as 24 vagas", () => {
  const vitrine = selecionarVitrineInicial(produtos.map((p, i) => ({ ...p, estoque: i < 10 ? 0 : 1 })), p => p.estoque);
  assert.equal(vitrine.length, 24);
  assert.equal(vitrine[0].id, "10");
  assert.equal(vitrine[23].id, "33");
});
test("preserva destaques e não completa a lista com produtos sem venda nem destaque", () => {
  const vitrine = selecionarVitrineInicial([
    { ...produtos[0], id: "comum", mais_vendido: false },
    { ...produtos[1], id: "destaque", destaque: true, mais_vendido: false },
    produtos[2],
  ], p => p.estoque);
  assert.deepEqual(vitrine.map(p => p.id), ["destaque", "2"]);
});
