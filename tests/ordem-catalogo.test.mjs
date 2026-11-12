import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../lib/ordem-catalogo.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {ordenarCatalogo,esgotadosNoFinal}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const p=(nome,estoque,categoria_id='outros',tipo_venda='avulso',unidades_por_venda=1)=>({id:nome,nome,estoque,categoria_id,tipo_venda,unidades_por_venda});
test('categorias e busca mantêm alfabética em cada faixa de estoque sem mutar entrada',()=>{
 const entrada=[p('Abacaxi',0),p('Uva',2),p('Água',3),p('Banana',0)];
 assert.deepEqual(ordenarCatalogo(entrada,p=>p.estoque,'cervejas').map(p=>p.nome),['Água','Uva','Abacaxi','Banana']);
 assert.equal(entrada[0].nome,'Abacaxi');
});
test('cerveja: caixas e packs disponíveis, avulsas disponíveis, esgotados alfabéticos',()=>{
 const entrada=[p('A caixa',0,'cervejas','caixa'),p('C avulsa',3,'cervejas'),p('Z caixa',1,'cervejas','caixa'),p('B pack',1,'cervejas',null,6),p('A avulsa',0,'cervejas'),p('A disponível',2,'cervejas')];
 assert.deepEqual(ordenarCatalogo(entrada,p=>p.estoque,'cervejas').map(p=>p.nome),['B pack','Z caixa','A disponível','C avulsa','A avulsa','A caixa']);
});
test('estoque calculado prevalece e esgotados ficam após todas as subseções',()=>{
 const a=p('Essência A',10),b=p('Essência B',1),c=p('Acessório A',2),d=p('Acessório B',0);
 const estoque=p=>p===a?0:p.estoque;
 const secoes=[{id:'essencias',titulo:'Essências',descricao:'',produtos:[b,a]},{id:'outros',titulo:'Outros',descricao:'',produtos:[c,d]}];
 assert.deepEqual(esgotadosNoFinal(secoes,estoque).map(s=>s.produtos.map(p=>p.nome)),[['Essência B'],['Acessório A'],['Acessório B','Essência A']]);
 assert.equal(secoes[0].produtos.length,2);
});
