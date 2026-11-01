import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
const source = readFileSync(new URL('../components/Catalogo.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('Catalogo.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = [];
function visit(node) {
 if (ts.isFunctionDeclaration(node) && ['finalizarPedido', 'apresentarPedidoRecuperado'].includes(node.name?.text)) functions.push(node.getText(ast));
 ts.forEachChild(node, visit);
}
visit(ast);
const compile = code => ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function setup(response) {
 const storage = new Map(); const state = {}; const calls = []; const logs = [];
 const ctx = {exports:{},crypto:webcrypto,TextEncoder,Date,Number,JSON,Intl,Response,
  window:{location:{origin:'https://loja.test'}}, WHATSAPP_GUETTO:'5544000000000',
  armazenamentoLocal:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  tentativaPedidoRef:{current:{chave:'11111111-1111-4111-8111-111111111111',assinatura:'anterior'}},
  envioPedidoRef:{current:false},enviandoPedido:false,maiorDeIdadeConfirmado:true,
  validarIdentificacaoEEndereco:()=>true,validarPagamento:()=>true,pagamentosSelecionados:()=>[],
  carrinho:[],quantidadePagamentos:1,valorTotal:90,somenteRetiradaHoje:false,tempoEntrega:45,
  nomeCompleto:'Teste',telefone:'00000000000',endereco:'Rua teste',numeroEndereco:'1',bairro:'Centro',cidadeEntrega:'Paranacity',referencia:'',quantidadeGarrafas300:0,vasilhameConfirmado:false,
  formatarPreco:v=>String(v),registrarErroCliente:(...v)=>logs.push(v),alert:msg=>{state.aviso=msg;},
  fetchComTimeout:async (url,init)=>{calls.push({url,init});return response;},
 };
 for(const key of ['EnviandoPedido','PedidoConfirmado','ErroRevisao','UltimoPedidoId','RevisaoAberta','CarrinhoAberto'])ctx['set'+key]=v=>{state[key]=v;};
 vm.createContext(ctx);
 for (const name of ['confirmacao-pedido','tentativa-pedido']) vm.runInContext(compile(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8')),ctx);
 vm.runInContext(compile(functions.join('\n')),ctx);
 return {ctx,state,calls,logs};
}
const id='22222222-2222-4222-8222-222222222222';
test('confirmar com conflito abre WhatsApp do pedido original sem segundo POST nem alerta falso',async()=>{
 const s=setup(Response.json({codigo:'PEDIDO_JA_REGISTRADO',pedido:{id,total:60,itens:[{nome:'Item original',quantidade:1,preco_unitario:60}]}},{status:409}));
 await s.ctx.finalizarPedido(true);
 assert.equal(s.calls.length,1); assert.equal(s.calls[0].init.method,'POST');
 assert.equal(s.logs.length,0); assert.equal(s.state.RevisaoAberta,false);
 assert.equal(s.state.PedidoConfirmado.id,id);
 const message=new URL(s.state.PedidoConfirmado.linkWhatsApp).searchParams.get('text');
 assert.match(message,/Item original/);assert.match(message,/60,00/);assert.doesNotMatch(message,/90,00/);
 assert.match(s.state.PedidoConfirmado.aviso,/Alterações.*não foram aplicadas/);
 assert.equal(s.ctx.envioPedidoRef.current,false);assert.equal(s.state.EnviandoPedido,false);
});
test('pedido encerrado libera nova tentativa apenas no próximo clique e não mostra WhatsApp antigo',async()=>{
 const s=setup(Response.json({codigo:'PEDIDO_JA_REGISTRADO',pedido:{id,arquivado:true}},{status:409}));
 await s.ctx.finalizarPedido(true);
 assert.equal(s.calls.length,1);assert.equal(s.state.PedidoConfirmado,null);
 assert.match(s.state.ErroRevisao,/carrinho foi mantido/);
 const next=await s.ctx.obterTentativaPedido('{}',s.ctx.tentativaPedidoRef.current,null);
 assert.notEqual(next.chave,s.calls[0].init.headers['Idempotency-Key']);
});
test('outros conflitos continuam visíveis e não recuperam um pedido indevido',async()=>{
 const s=setup(Response.json({error:'Estoque insuficiente'},{status:409}));
 await s.ctx.finalizarPedido(true);
 assert.equal(s.state.ErroRevisao,'Estoque insuficiente');assert.equal(s.state.PedidoConfirmado,undefined);
 assert.equal(s.calls.length,1);assert.equal(s.logs[0][0],'pedido_http');
});
