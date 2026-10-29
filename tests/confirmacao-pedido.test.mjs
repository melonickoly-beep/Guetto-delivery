import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../lib/confirmacao-pedido.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {criarConfirmacao,recuperarConfirmacao}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const id='11111111-1111-4111-8111-111111111111';
test('recupera mensagem sem confiar em URLs locais e expira em 24 horas',()=>{
 const agora=Date.now();
 const salvo=JSON.stringify({id,mensagem:'Pedido R$ 10,00',salvoEm:agora,linkWhatsApp:'javascript:alert(1)',linkAcompanhamento:'https://externo.test'});
 const pedido=recuperarConfirmacao(salvo,'https://loja.test','5544000000000',agora);
 assert.equal(pedido.mensagem,'Pedido R$ 10,00');
 assert.equal(pedido.linkAcompanhamento,'https://loja.test/acompanhar/'+id);
 assert.match(pedido.linkWhatsApp,/^https:\/\/wa.me\/5544000000000\?text=/);
 assert.equal(recuperarConfirmacao(salvo,'https://loja.test','55',agora+86400000),null);
 assert.equal(recuperarConfirmacao('invalido','https://loja.test','55'),null);
 assert.throws(()=>criarConfirmacao('id-invalido','mensagem','https://loja.test','55'));
});
