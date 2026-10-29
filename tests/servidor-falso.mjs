// Fixture HTTP de Supabase para navegação local; dados fictícios, sem credenciais reais.
import http from 'node:http';
let falhaCatalogo=false, falhaPainel=false;
const id='11111111-1111-4111-8111-111111111111';
const produto={id:'33333333-3333-4333-8333-333333333333',categoria_id:id,nome:'Produto de teste',descricao:'Somente teste local',preco:10,estoque:30,imagem:null,destaque:true,tipo_venda:'avulso',disponivel:true};
const configuracoes=[{chave:'tempo_entrega',valor:'20'},{chave:'horario_abertura',valor:'00:00'},{chave:'horario_fechamento',valor:'23:59'},{chave:'somente_retirada',valor:'false'},{chave:'detalhes_essencias',valor:'{}'}];
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
 res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 const url=new URL(req.url,'http://localhost'); const p=url.pathname;
 const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(p==='/__controle'){falhaCatalogo=url.searchParams.get('catalogo')==='falha';falhaPainel=url.searchParams.get('painel')==='falha';return send({ok:true});}
 if(p==='/auth/v1/user')return send({id,email:'admin@loja.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}});
 if(p==='/rest/v1/produtos')return falhaCatalogo?send({message:'Falha simulada'},503):send([produto]);
 if(p==='/rest/v1/categorias')return send([{id,nome:'Conveniência',icone:'🍫'}]);
 if(p==='/rest/v1/configuracoes'){
  const chave=url.searchParams.get('chave');if(chave?.startsWith('eq.'))return send(configuracoes.find(c=>c.chave===chave.slice(3))??null);
  return send(configuracoes);
 }
 if(p==='/rest/v1/pedidos')return falhaPainel?send({message:'Falha simulada'},503):send(url.searchParams.has('id')?null:[]);
 if(p==='/rest/v1/pedidos_situacao_final')return send({status:'concluido'});
 if(p==='/rest/v1/rpc/obter_resumo_pedidos_hoje')return falhaPainel?send({message:'Falha simulada'},503):send([{data_referencia:'2026-10-28',pedidos_ativos:0,pedidos_concluidos:0,pedidos_total:0}]);
 if(p.startsWith('/storage/v1/bucket/'))return send({id:'resumos-sorteio',name:'resumos-sorteio'});
 if(p.startsWith('/storage/v1/object/list/'))return send([]);
 if(p.includes('/ranking/'))return send({});
 return send({error:'Endpoint não simulado: '+p},404);
}).listen(54329,'127.0.0.1',()=>console.log('Fixture local: 54329'));
