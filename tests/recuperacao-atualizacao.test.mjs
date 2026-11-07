import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const ler = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const compilar = code => ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;

test('recarga restaura mensagem válida sem navegar nem reenviar; expirada é removida',()=>{
 const source=ler('components/Catalogo.tsx');
 const ast=ts.createSourceFile('c.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let callback;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const salvo = recuperarConfirmacao'))callback=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}
 visit(ast);assert.ok(callback);
 const id='11111111-1111-4111-8111-111111111111';
 for(const expirado of [false,true]){
  let restored=null,removed=false;
  const ctx={exports:{},Date,JSON,Number,window:{location:{origin:'https://loja.test'}},WHATSAPP_GUETTO:'5544000000000',
   armazenamentoLocal:{getItem:()=>JSON.stringify({id,mensagem:'Pedido já registrado',salvoEm:Date.now()-(expirado?86400001:1000)}),removeItem:()=>{removed=true;}},
   setPedidoConfirmado:v=>{restored=v;}};
  vm.createContext(ctx);vm.runInContext(compilar(ler('lib/confirmacao-pedido.ts')),ctx);
  vm.runInContext(compilar('('+callback+')();'),ctx);
  assert.equal(removed,expirado);assert.equal(restored?.id??null,expirado?null:id);
 }
});

test('acompanhamento atualiza, pausa oculto/offline/pendente e remove timers ao desmontar',()=>{
 for(const pending of [false,true]){
  let cleanup,interval,refreshes=0,cleared=false;const handlers={};
  const ctx={exports:{},navigator:{onLine:true},document:{visibilityState:'visible',addEventListener:(k,v)=>handlers[k]=v,removeEventListener:k=>delete handlers[k]},
   window:{setInterval:(fn,ms)=>{assert.equal(ms,15000);interval=fn;return 1;},clearInterval:()=>{cleared=true;},addEventListener:(k,v)=>handlers[k]=v,removeEventListener:k=>delete handlers[k]},
   require:n=>n==='react'?{useEffect:fn=>{cleanup=fn();},useTransition:()=>[pending,fn=>fn()]}:n==='next/navigation'?{useRouter:()=>({refresh:()=>refreshes++})}:{jsx:()=>null}};
  vm.runInNewContext(compilar(ler('components/AtualizarAcompanhamento.tsx')),ctx);ctx.exports.default();
  interval();assert.equal(refreshes,pending?0:1);
  ctx.document.visibilityState='hidden';interval();assert.equal(refreshes,pending?0:1);
  ctx.document.visibilityState='visible';ctx.navigator.onLine=false;interval();assert.equal(refreshes,pending?0:1);
  ctx.navigator.onLine=true;handlers.online();assert.equal(refreshes,pending?0:2);
  cleanup();assert.ok(cleared);assert.equal(Object.keys(handlers).length,0);
 }
});
