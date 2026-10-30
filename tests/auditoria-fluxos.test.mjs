import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function carregar(path, overrides = {}, globals = {}) {
 const {outputText}=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 const ctx={exports:{},console,Request,Response,Intl,Date,URL,Map,Set,process,...globals,require(name){
  if(name in overrides)return overrides[name];
  if(name==='next/server') return {NextResponse:Response};
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='next/link'||name==='next/image')return {default:'elemento'};
  if(name==='next/cache')return {unstable_cache:fn=>fn};
  if(name==='lucide-react')return {};
  if(name.startsWith('@/components/'))return {default:'componente'};
  if(name.startsWith('@/lib/'))return carregar(name.slice(2)+'.ts',overrides,globals);
  return require(name);
 }};
 vm.runInNewContext(outputText,ctx);return ctx.exports;
}
function cliente(respostas) {return {from(tabela) {
 const result=respostas[tabela]??{data:null,error:null};
 const chain=new Proxy({}, {get(_obj,key){ if(key==='then') return Promise.resolve(result).then.bind(Promise.resolve(result)); return ()=>chain; }});
 return chain;
},rpc(){throw new Error('RPC não deveria ser chamada');}};}
function texto(tree) {
 if(tree==null)return ''; if(typeof tree!=='object')return String(tree);
 if(Array.isArray(tree))return tree.map(texto).join(' ');
 if(typeof tree.type==='function')return texto(tree.type(tree.props));
 return texto(tree.props?.children);
}
const id='11111111-1111-4111-8111-111111111111';
const alertas=[];
const mockAlertas={alertarErroCritico:(...args)=>alertas.push(args)};
const acompanhar = respostas => carregar('app/acompanhar/[id]/page.tsx',{'@/lib/supabase-admin':{supabaseAdmin:cliente(respostas)},'@/lib/alertas':mockAlertas}).default({params:Promise.resolve({id})});
test('acompanhamento distingue ausência, conclusão, cancelamento e falha de consulta', async()=>{
 assert.match(texto(await acompanhar({})),/Pedido não localizado/);
 assert.match(texto(await acompanhar({pedidos_situacao_final:{data:{status:'concluido'}}})),/Pedido entregue/);
 assert.match(texto(await acompanhar({pedidos_situacao_final:{data:{status:'cancelado'}}})),/Pedido cancelado/);
 await assert.rejects(acompanhar({pedidos:{data:null,error:{message:'falha'}}}),/Não foi possível consultar/);
 await assert.rejects(acompanhar({pedidos_situacao_final:{data:null,error:{message:'falha'}}}),/Consulta indisponível/);
});
test('catálogo com falha de produtos, categorias ou configuração não renderiza vitrine vazia',async()=>{
 for(const tabela of ['produtos','categorias','configuracoes']){
  const Home=carregar('app/page.tsx',{
   '@/lib/supabase':{supabase:cliente({[tabela]:{error:{message:'falha'}}})},
   '@/lib/resumo-sorteio':{obterProdutosMaisVendidosDaSemana:async()=>[]},
   '@/lib/alertas':mockAlertas,
  }).default;
  await assert.rejects(Home(),/Não foi possível carregar os produtos/);
 }
});
function rota(respostas, globals={}) {
 return carregar('app/api/pedidos/route.ts',{
  '@/lib/supabase-admin':{supabaseAdmin:cliente(respostas)},
  '@/lib/resumo-sorteio':{registrarPedidoNoResumo:async()=>{}},
  '@/lib/alertas':mockAlertas,
 },globals);
}
const request=body=>new Request('https://loja.test/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(body)});
test('terça-feira continua bloqueando novos pedidos na API',async()=>{
 class Terca extends Date {constructor(...args){super(...(args.length?args:['2026-10-27T18:00:00-03:00']));} static now(){return new Date('2026-10-27T18:00:00-03:00').getTime();}}
 const {POST}=rota({}, {Date:Terca});
 const resposta=await POST(request({tipo_atendimento:'delivery'}));
 assert.equal(resposta.status,403);assert.match((await resposta.json()).error,/presencialmente/);
});
test('API recupera total e itens sem registrar uma segunda compra e rejeita outro conteúdo',async()=>{
 const body={teste:true}; const assinatura=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 const anterior={pedido_id:id,assinatura,resposta:{id,total:10,itens:[{nome:'Teste',quantidade:1,preco_unitario:10}]}};
 const {POST,GET}=rota({pedidos_idempotencia:{data:anterior}});
 assert.deepEqual(await (await POST(request(body))).json(),anterior.resposta);
 assert.equal((await POST(request({teste:false}))).status,409);
 const recuperada=await GET(new Request('https://loja.test/api/pedidos',{headers:{'Idempotency-Key':id}}));
 assert.equal(recuperada.headers.get('cache-control'),'no-store');
 assert.deepEqual(await recuperada.json(),anterior.resposta);
});
test('falha do registro é 503 e dispara alerta sem expor dados do erro',async()=>{
 const {POST}=rota({pedidos_idempotencia:{error:{message:'dado privado'}}});
 const resposta=await POST(request({}));
 assert.equal(resposta.status,503);assert.ok(!(await resposta.text()).includes('dado privado'));
 assert.ok(alertas.some(([codigo])=>codigo==='pedido_post'));
});
