import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage();
page.setDefaultTimeout(30_000);
try {
 await fetch('http://127.0.0.1:54329/__controle');
 await page.goto('http://localhost:3100/',{waitUntil:'networkidle'});
 await page.getByText('Produto de teste',{exact:true}).waitFor();
 assert.equal(await page.getByText('Não conseguimos abrir esta tela.').count(),0);
 console.log('OK: catálogo em viewport móvel.');
 const id='11111111-1111-4111-8111-111111111111';
 await page.evaluate(id=>localStorage.setItem('guetto_mensagem_pendente',JSON.stringify({id,mensagem:'Pedido de teste registrado, total R$ 10,00',salvoEm:Date.now()})),id);
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'PEDIDO REGISTRADO',exact:true}).waitFor();
 assert.match(await page.getByRole('link',{name:'ABRIR WHATSAPP',exact:true}).getAttribute('href'),/^https:\/\/wa.me\//);
 assert.match(page.url(),/^http:\/\/localhost:3100/);
 await page.getByRole('button',{name:'CONTINUAR NO CARDÁPIO'}).click();
 console.log('OK: mensagem recuperada após recarga; nenhum redirecionamento automático ao WhatsApp.');
 await fetch('http://127.0.0.1:54329/__controle?catalogo=falha');
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Não conseguimos abrir esta tela.'}).waitFor();
 await fetch('http://127.0.0.1:54329/__controle');
 await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await page.getByText('Produto de teste',{exact:true}).waitFor();
 console.log('OK: falha do catálogo aparece; tentar novamente recupera produtos.');
 await page.goto('http://localhost:3100/acompanhar/'+id,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Pedido entregue',exact:true}).waitFor();
 console.log('OK: conclusão excluída aparece como entregue.');
 // Sessão fictícia aceita somente pelo servidor HTTP local da fixture.
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'teste'].join('.');
 const sessao={access_token:token,refresh_token:'teste',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id,email:'admin@loja.test'}};
 await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(sessao)).toString('base64url'),domain:'localhost',path:'/'}]);
 await context.addInitScript(()=>sessionStorage.setItem('guetto_admin_desbloqueado','1'));
 await page.goto('http://localhost:3100/admin',{waitUntil:'networkidle'});
 await page.getByText(/Pedidos atualizados às/).waitFor();
 await fetch('http://127.0.0.1:54329/__controle?painel=falha');
 await page.getByText(/Não foi possível atualizar os pedidos/).waitFor({timeout:30_000});
 await fetch('http://127.0.0.1:54329/__controle');
 await page.getByRole('button',{name:'Tentar atualizar agora'}).click();
 await page.getByText(/Pedidos atualizados às/).waitFor();
 console.log('OK: painel informa falha e recuperação preserva consulta.');
} finally {await browser.close();}

