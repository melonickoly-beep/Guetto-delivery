import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
test('monitor distingue imagens, scripts, CSS e erros JavaScript sem coletar URLs',()=>{
 const handlers={};const events=[];
 class Script {} class Link {constructor(rel){this.relList={contains:x=>x===rel};}} class JSerror {constructor(){this.error=new Error('teste');}}
 const source=readFileSync(new URL('../components/MonitorErros.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx={exports:{},HTMLScriptElement:Script,HTMLLinkElement:Link,ErrorEvent:JSerror,window:{addEventListener:(k,v)=>handlers[k]=v,removeEventListener:()=>{}},require:n=>n==='react'?{useEffect:fn=>fn()}:{registrarErroCliente:(...v)=>events.push(v)}};
 vm.runInNewContext(code,ctx);ctx.exports.default();
 handlers.error({target:{src:'https://privado.test/imagem'}});
 handlers.error({target:new Script()});handlers.error({target:new Link('stylesheet')});handlers.error({target:new Link('icon')});handlers.error(new JSerror());
 assert.deepEqual(events.map(e=>e[0]),['recurso','recurso_critico','recurso_critico','recurso','javascript']);
 assert.ok(!JSON.stringify(events).includes('privado.test'));
});
