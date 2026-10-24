import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../lib/preco-cervejas.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { dividirCervejaEmEmbalagens, subtotalCerveja } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const base = { categoria_id: "cervejas", grupo_estoque: "cerveja-imperio-ultra-long-neck", disponivel: true };
const unidade = { ...base, id: "unidade", nome: "Império Ultra - Long neck", tipo_venda: "avulso", unidades_por_venda: 1, preco: 6 };
const pack = { ...base, id: "pack", nome: "Império Ultra - Pack 6", tipo_venda: "caixa", unidades_por_venda: 6, preco: 36 };
const caixa = { ...base, id: "caixa", nome: "Império Ultra - Cx com 12 long necks", tipo_venda: "caixa", unidades_por_venda: 12, preco: 65 };
const produtos = [unidade, pack, caixa];

test("pares de packs viram caixas, preservando unidades e preço promocional", () => {
  for (let quantidade = 1; quantidade <= 9; quantidade++) {
    const partes = dividirCervejaEmEmbalagens(pack, quantidade, produtos, "cervejas");
    assert.equal(partes.reduce((n, p) => n + p.quantidade * p.produto.unidades_por_venda, 0), quantidade * 6);
    assert.equal(partes.filter(p => p.produto.id === "caixa").reduce((n, p) => n + p.quantidade, 0), Math.floor(quantidade / 2));
    assert.equal(partes.filter(p => p.produto.id === "pack").reduce((n, p) => n + p.quantidade, 0), quantidade % 2);
    const contexto = partes.map(p => ({ id: p.produto.id, quantidade: p.quantidade }));
    const total = partes.reduce((n, p, indice) => n + subtotalCerveja(p.produto, p.quantidade, produtos, "cervejas", { itens: contexto, indice }), 0);
    assert.equal(Math.round(total * 100), Math.round(subtotalCerveja(pack, quantidade, produtos, "cervejas") * 100));
  }
});

test("não substitui por caixa indisponível, de outra cerveja ou outra categoria", () => {
  for (const alternativa of [{ ...caixa, disponivel: false }, { ...caixa, grupo_estoque: "outra" }, { ...caixa, categoria_id: "outra" }]) {
    assert.deepEqual(dividirCervejaEmEmbalagens(pack, 2, [unidade, pack, alternativa], "cervejas"), [{ produto: pack, quantidade: 2 }]);
  }
  assert.deepEqual(dividirCervejaEmEmbalagens(caixa, 2, produtos, "cervejas"), [{ produto: caixa, quantidade: 2 }]);
});
