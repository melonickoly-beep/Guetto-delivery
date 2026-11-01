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
 let source=readFileSync(new URL('../app/api/erros-cliente/route.ts',import.meta.url),'utf8').replace('@/lib/diagnostico-cliente',url).replace('import { alertarErroCritico } from "@/lib/alertas";', 'export const alertas = []; const alertarErroCritico = (...args) => alertas.push(args);');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 const {POST,alertas}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
 const request=(body,origin='https://guettodelivery.com.br')=>new Request('https://guettodelivery.com.br/api/erros-cliente',{method:'POST',headers:{origin,'content-type':'application/json'},body});
 const original=console.error;const logs=[];console.error=(v)=>logs.push(v);
 try {
  assert.equal((await POST(request(JSON.stringify({tipo:'tela',nome:'Maria'})))).status,204);
  assert.equal(logs.length,1);assert.ok(!logs[0].includes('Maria'));
  assert.deepEqual(alertas, [['cliente_tela', 500]]);
  alertas.length = 0;
  // Repetição, navegador antigo e status informado não promovem o diagnóstico
  // genérico do painel a incidente confirmado; todos permanecem nos logs.
  for (const status of [undefined, undefined, 500, 503]) {
   assert.equal((await POST(request(JSON.stringify({tipo:'painel',pagina:'/admin',status})))).status,204);
  }
  assert.equal(alertas.length, 0);
  assert.equal(logs.length, 5);
  assert.equal(JSON.parse(logs[1]).status, null);
  assert.equal(JSON.parse(logs[4]).status, 503);
  assert.equal((await POST(request(JSON.stringify({tipo:'pedido_http',status:503})))).status,204);
  assert.deepEqual(alertas, [['cliente_pedido_http', 503]]);
  const proxy = new Request('http://localhost:3000/api/erros-cliente', {method:'POST',headers:{origin:'https://guettodelivery.com.br','content-type':'application/json'},body:JSON.stringify({tipo:'tela'})});
  assert.equal((await POST(proxy)).status,204);
  assert.equal((await POST(request('{}','https://externo.test'))).status,403);
  assert.equal((await POST(request('x'.repeat(2049)))).status,413);
  assert.equal((await POST(request('invalid'))).status,400);
 }finally{console.error=original;}
});
