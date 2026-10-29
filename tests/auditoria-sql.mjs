// Banco PostgreSQL descartável em memória. Não lê .env e não acessa produção.
import { PGlite } from '../tmp/sql-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const admin='11111111-1111-4111-8111-111111111111';
const outro='22222222-2222-4222-8222-222222222222';
const produto='33333333-3333-4333-8333-333333333333';
const pedido='44444444-4444-4444-8444-444444444444';
const arquivo = nome => readFileSync(new URL('../supabase/migrations/'+nome,import.meta.url),'utf8');
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key);
insert into auth.users values ('${admin}'),('${outro}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create table public.categorias(id uuid primary key default gen_random_uuid(),nome text);
create table public.produtos(id uuid primary key default gen_random_uuid(),nome text,preco numeric);
create table public.configuracoes(chave text primary key,valor text);
create table public.pedidos(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),status text,total numeric,itens jsonb);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant all on all tables in schema public,storage to anon,authenticated,service_role;
create policy legado on storage.objects for all to authenticated using(true) with check(true);
create policy legado on public.pedidos for all to authenticated using(true) with check(true);
insert into public.produtos values('${produto}','Produto de teste',10);
insert into public.pedidos values('${pedido}',now(),'novo',10,'[]');
insert into public.configuracoes values('tempo_entrega','20'),('segredo_admin','privado');
insert into storage.objects(bucket_id,name) values('produtos','teste.png'),('resumos-sorteio','pessoal.json');
create function public.funcao_privilegiada_legada() returns void language plpgsql security definer as $$ begin delete from public.pedidos; end $$;
-- Fixture da função de preços; a lógica de promoções possui testes próprios.
create function public.criar_pedido_seguro(text,text,text,text,jsonb,jsonb,integer,text) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
  insert into public.pedidos(status,total,itens) values('novo',10,'[{"nome":"Produto de teste","quantidade":1,"preco_unitario":10}]') returning id into v_id;
  return v_id;
end $$;
set app.admin_user_id='${admin}';
`);
await db.exec(arquivo('20261017_impedir_pedidos_duplicados.sql'));
await db.exec(arquivo('20260803_excluir_pedidos_concluidos_e_manter_contagem.sql'));
await db.exec(arquivo('20261028_restringir_administracao.sql'));
await db.exec(arquivo('20261028_conferir_precos_e_acompanhamento.sql'));
const count = async table => Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
async function papel(role,id,fn) {
 await db.exec(`set role ${role}; set request.jwt.claim.sub='${id??''}';`);
 try { await fn(); } finally { await db.exec('reset role;'); }
}
await papel('anon',null,async()=>{
 assert.equal(await count('public.produtos'),1);
 assert.equal(await count('public.configuracoes'),1);
 await assert.rejects(db.query('select * from public.pedidos'),/permission denied/);
 await assert.rejects(db.query("insert into public.produtos(nome) values('ataque')"),/permission denied/);
 await assert.rejects(db.query('select public.funcao_privilegiada_legada()'),/permission denied/);
});
await papel('authenticated',outro,async()=>{
 assert.equal(await count('public.pedidos'),0);
 assert.equal(await count('public.configuracoes'),1);
 assert.equal((await db.query("update public.produtos set preco=0 returning id")).rows.length,0);
 assert.equal((await db.query("delete from public.pedidos returning id")).rows.length,0);
 await assert.rejects(db.query("insert into public.configuracoes values('intruso','sim')"),/row-level security/);
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('produtos','ataque.png')"),/row-level security/);
 assert.equal((await db.query("update storage.objects set name='ataque' where bucket_id='produtos' returning id")).rows.length,0);
 assert.equal((await db.query("select * from storage.objects where bucket_id='resumos-sorteio'")).rows.length,0);
 await assert.rejects(db.query('select public.funcao_privilegiada_legada()'),/permission denied/);
 await assert.rejects(db.query('select * from public.administrador_autorizado'),/permission denied/);
});
await papel('authenticated',admin,async()=>{
 assert.equal(await count('public.pedidos'),1);
 assert.equal(await count('public.configuracoes'),2);
 assert.equal((await db.query("update public.produtos set preco=11 returning id")).rows.length,1);
 assert.equal((await db.query("insert into storage.objects(bucket_id,name) values('produtos','admin.png') returning id")).rows.length,1);
});
console.log('OK: RLS anon, autenticado não administrador, administrador; Storage e RPC privilegiada.');
const chave='55555555-5555-4555-8555-555555555555';
const assinatura='a'.repeat(64);
const chamar=(chave,total,hash=assinatura)=> db.query(`select public.criar_pedido_conferido($1,$2,$3,'Teste','000','Teste','', '[]','[]',20,'') as resposta`,[chave,hash,total]);
await papel('service_role',null,async()=>{
 const antes=await count('public.pedidos');
 await assert.rejects(chamar(chave,99),/preços mudaram/);
 assert.equal(await count('public.pedidos'),antes);
 assert.equal(await count('public.pedidos_idempotencia'),0);
 const results=await Promise.all([chamar(chave,10),chamar(chave,10)]);
 const primeiro=results[0].rows[0].resposta;
 assert.deepEqual(results[1].rows[0].resposta,primeiro);
 assert.equal(await count('public.pedidos'),antes+1);
 await assert.rejects(chamar(chave,10,'b'.repeat(64)),/tentativa já pertence/);
 // Rotina real de conclusão apaga o pedido; trigger novo preserva só a situação.
 await db.query("update public.pedidos set status='concluido' where id=$1",[primeiro.id]);
 assert.equal((await db.query('select * from public.pedidos where id=$1',[primeiro.id])).rows.length,0);
 assert.equal((await db.query('select status from public.pedidos_situacao_final where pedido_id=$1',[primeiro.id])).rows[0].status,'concluido');
 assert.deepEqual((await chamar(chave,10)).rows[0].resposta,primeiro);
 await db.query("update public.pedidos set status='cancelado' where id=$1",[pedido]);
 await db.query('delete from public.pedidos where id=$1',[pedido]);
 assert.equal((await db.query('select status from public.pedidos_situacao_final where pedido_id=$1',[pedido])).rows[0].status,'cancelado');
});
console.log('OK: preço divergente reverte pedido e chave; repetição retorna mesmo pedido; assinatura diferente recusada; situação final e recuperação após exclusão.');
await db.close();
