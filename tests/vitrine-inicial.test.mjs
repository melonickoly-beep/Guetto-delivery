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

test("oculta cervejas avulsas, preservando caixas, packs e outros produtos avulsos", () => {
  const base = { ...produtos[0], categoria_id: "cervejas", tipo_venda: "avulso", unidades_por_venda: 1 };
  const vitrine = selecionarVitrineInicial([
    { ...base, id: "lata", nome: "Cerveja Skol AG - 350ml - Lata avulsa" },
    { ...base, id: "long", nome: "Cerveja Heineken - 330ml - Long neck avulsa" },
    { ...base, id: "caixa", nome: "Cerveja Skol AG - 350ml - Cx com 12 unidades", tipo_venda: "caixa", unidades_por_venda: 12 },
    { ...base, id: "pack", nome: "Cerveja Heineken - Pack com 6 long necks", tipo_venda: "caixa", unidades_por_venda: 6 },
    { ...base, id: "caixa-legada", nome: "Cerveja Stella - 350ml - Cx com 8 unidades" },
    { ...base, id: "monster", nome: "Energético Monster 473ml", categoria_id: "energeticos" },
  ], p => p.estoque, "cervejas");
  assert.deepEqual(vitrine.map(p => p.id), ["caixa", "pack", "caixa-legada", "monster"]);
});

test("garrafa de 300 ml só entra com posição real no ranking de vendas", () => {
  const base = { ...produtos[0], categoria_id: "cervejas", tipo_venda: "avulso", unidades_por_venda: 1 };
  const vitrine = selecionarVitrineInicial([
    { ...base, id: "300-vendida", nome: "Cerveja Brahma - Garrafa 300ml - Unidade" },
    { ...base, id: "300-manual", nome: "Cerveja Skol - Garrafa 300ml - Unidade", destaque: true, posicao_mais_vendido: null },
    { ...base, id: "600", nome: "Cerveja Heineken - Garrafa 600ml - Unidade" },
    { ...base, id: "legado", nome: "Original - lata 350ml" },
  ], p => p.estoque, "cervejas");
  assert.deepEqual(vitrine.map(p => p.id), ["300-vendida"]);
});

test("cervejas avulsas não ocupam vagas dos 24 itens da vitrine", () => {
  const latas = produtos.slice(0, 5).map(p => ({ ...p, id: `lata-${p.id}`, nome: "Cerveja em lata", tipo_venda: "avulso", unidades_por_venda: 1 }));
  const vitrine = selecionarVitrineInicial([...latas, ...produtos], p => p.estoque);
  assert.equal(vitrine.length, 24);
  assert.ok(vitrine.every(p => !p.id.startsWith("lata-")));
});
