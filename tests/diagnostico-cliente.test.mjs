import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
function modulo(path) {
 const {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const url=modulo('../lib/diagnostico-cliente.ts');
const {normalizarDiagnostico}=await import(url);
test('diagnóstico descarta dados pessoais, mensagens e URLs de pedidos',()=>{
 const result=normalizarDiagnostico({tipo:'tela',pagina:'/acompanhar/pedido-secreto?telefone=44999999999',erro:'TypeError',nome:'Maria',mensagem:'Rua pessoal',codigo:'segredo',local:'https://site/pedido',navegador:'Chrome',sistema:'Android'});
 assert.equal(result.pagina,'outro'); assert.equal(result.codigo,null); assert.equal(result.local,null);
 assert.ok(!JSON.stringify(result).includes('Maria')); assert.ok(!JSON.stringify(result).includes('segredo'));
 assert.equal(normalizarDiagnostico({tipo:'invalido'}),null);
});
test('diagnóstico conserva localização técnica sem parâmetros nem mensagens',()=>{
 const result=normalizarDiagnostico({tipo:'javascript',pagina:'/',erro:'TypeError',local:'/_next/static/chunks/app/page-ab12.js:1:234',codigo:'12345',status:500});
 assert.equal(result.local,'/_next/static/chunks/app/page-ab12.js:1:234');assert.equal(result.codigo,'12345');assert.equal(result.status,500);
});
test('coletor aceita evento sanitizado e rejeita origem externa, excesso e JSON inválido',async()=>{
 let source=readFileSync(new URL('../app/api/erros-cliente/route.ts',import.meta.url),'utf8').replace('@/lib/diagnostico-cliente',url);
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 const {POST}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
 const request=(body,origin='https://guettodelivery.com.br')=>new Request('https://guettodelivery.com.br/api/erros-cliente',{method:'POST',headers:{origin,'content-type':'application/json'},body});
 const original=console.error;const logs=[];console.error=(v)=>logs.push(v);
 try {
  assert.equal((await POST(request(JSON.stringify({tipo:'tela',nome:'Maria'})))).status,204);
  assert.equal(logs.length,1);assert.ok(!logs[0].includes('Maria'));
  assert.equal((await POST(request('{}','https://externo.test'))).status,403);
  assert.equal((await POST(request('x'.repeat(2049)))).status,413);
  assert.equal((await POST(request('invalid'))).status,400);
 }finally{console.error=original;}
});
