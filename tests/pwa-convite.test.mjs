import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../components/PwaRegistro.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
function montar({permitido=false,path='/',dispensado=null,standalone=false}={}){
 const values=[],effects=[],events={};let index=0,first=true;
 const context={exports:{},navigator:{userAgent:'Android Chrome'},window:{matchMedia:()=>({matches:standalone}),addEventListener:(key,fn)=>events[key]=fn,removeEventListener:()=>{}},require:(name)=>{
  if(name==='react')return {useState:(initial)=>{const i=index++;if(first)values[i]=initial;return [values[i],v=>values[i]=v];},useEffect:fn=>{if(first)effects.push(fn);}};
  if(name==='next/navigation')return {usePathname:()=>path};
  if(name==='@/lib/armazenamento-local')return {armazenamentoLocal:{getItem:()=>dispensado,setItem:()=>{}}};
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='lucide-react')return {};
  throw new Error(name);
 }};
 vm.runInNewContext(outputText,context);const Component=context.exports.default;
 Component({convitePermitido:permitido});effects.forEach(fn=>fn());first=false;
 return {render:()=>{index=0;return Component({convitePermitido:permitido});},events};
}
test('não mostra convite na abertura, mesmo com evento de instalação',()=>{
 const app=montar();app.events.beforeinstallprompt({preventDefault(){}});assert.equal(app.render(),null);
});
test('mostra convite apenas no acompanhamento autorizado pelo pedido confirmado',()=>{
 assert.ok(montar({permitido:true,path:'/acompanhar/exemplo'}).render());
 assert.equal(montar({path:'/acompanhar/exemplo'}).render(),null);
 assert.equal(montar({permitido:true,path:'/'}).render(),null);
});
test('respeita dispensa recente no Android e aplicativo já instalado',()=>{
 assert.equal(montar({permitido:true,path:'/acompanhar/exemplo',dispensado:String(Date.now())}).render(),null);
 assert.equal(montar({permitido:true,path:'/acompanhar/exemplo',standalone:true}).render(),null);
});
