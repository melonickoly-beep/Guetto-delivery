import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("../lib/preco-bis.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { subtotalChocolateBis } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
test("Bis cobra trios completos e o restante a 7 reais", () => {
  for (const [quantidade, esperado] of [[1,7],[2,14],[3,18],[4,25],[5,32],[6,36],[12,72]]) {
    assert.equal(subtotalChocolateBis([{nome:'Chocolate Bis - Original',quantidade}],0),esperado);
  }
});
test("sabores misturados e linhas separadas preservam total sem arredondamento extra", () => {
  for(let a=1;a<=12;a++) for(let b=1;b<=12;b++) {
    const itens=[{nome:'Chocolate Bis - Original',quantidade:a},{nome:'Outro chocolate',quantidade:2},{nome:'Chocolate Bis - Branco',quantidade:b}];
    const soma = Math.round((subtotalChocolateBis(itens,0)+subtotalChocolateBis(itens,2))*100);
    assert.equal(soma,(Math.floor((a+b)/3)*18+((a+b)%3)*7)*100);
    assert.equal(subtotalChocolateBis(itens,1),null);
  }
});
