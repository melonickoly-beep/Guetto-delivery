-- Inventário somente leitura. Não corrige nem altera produção.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m') order by c.relname;
select p.oid::regprocedure as funcao, p.prosecdef,
  has_function_privilege('anon',p.oid,'execute') as anon_executa,
  has_function_privilege('authenticated',p.oid,'execute') as autenticado_executa
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef order by 1;
select id, public from storage.buckets where id in ('produtos','resumos-sorteio');
