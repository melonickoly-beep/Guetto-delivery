# Auditoria de 28/10/2026 — correções propostas

Base revisada: `origin/main`, commit `7b3618d`, atualizado com `git fetch` antes de alterar código. Relatório fornecido: `auditoria_guetto_delivery_28-10-2026.pdf`, quatro páginas. Os achados foram confrontados com o código, sem tratar recomendações do PDF como autorização para operar produção.

As alterações locais anteriores em `app/admin/page.tsx`, na API de pedidos e nos arquivos não rastreados ficaram intactas na pasta original. Esta branch usa uma cópia isolada da versão publicada. Portanto, as mudanças locais de reabertura de pedidos não fazem parte deste PR.

## Problemas confirmados e correções

| Prioridade | Evidência na versão revisada | Correção |
| --- | --- | --- |
| RLS | Políticas administrativas com `using (true)` para qualquer `authenticated`; `ADMIN_EMAIL` ausente liberava qualquer login. | Administrador identificado por UUID e e-mail no servidor; migração com identidade única por UUID, políticas específicas, Storage protegido e remoção de execução pública de funções privilegiadas. |
| Painel | Erros em `carregarPedidos` e no resumo eram ignorados; assinatura Realtime sem tratamento de estado. | Avisos, horário da última consulta, estado Realtime, recuperação manual, consultas sem sobreposição e espera progressiva de 10 a 60 segundos; alerta após 45 segundos sem sucesso. Mutações com timeout avisam que podem já ter sido gravadas. |
| Alertas | Coletor apenas escrevia nos logs e excluía `/admin`; teto de cinco eventos por página. | Códigos operacionais sem dados pessoais, webhook no servidor, deduplicação por minuto e coleta do painel; monitor externo opcional de catálogo, API e pedidos novos aguardando. |
| WhatsApp / duplicação | Redirecionamento automático; mensagem apenas em memória; chave descartada ao confirmar. | Botão explícito para abrir, mensagem recuperável por até 24 horas, campo para copiar, recuperação pela chave original e ação explícita para nova compra. Abertura não confirma envio. |
| Catálogo móvel | Erros das consultas ignorados, convertidos em listas vazias. | Erros acionam aviso com nova consulta completa; o teste de navegador também revelou e corrigiu o botão de recuperação que não refazia a consulta SSR. |
| Checkout instável | `fetch` sem prazo. | Prazo de 15 segundos incluindo leitura do corpo; sem repetição automática de mutações; reaproveitamento da chave mesmo se os dados forem corrigidos. Se o banco já registrou outra versão, recusa sem duplicar. |
| Preços | Mensagem formada com cálculo anterior ao POST; resposta só com ID. | Comparação em centavos com servidor, conferência transacional do total efetivamente gravado e retorno dos itens/total. Divergência desfaz a transação e exige atualizar/revisar. Mensagem usa itens confirmados, incluindo promoções e embalagens. |
| Acompanhamento | Ausência de registro era tratada como cancelamento, inclusive após exclusão na conclusão. | Diferencia ausência, falha, cancelamento e conclusão; novo registro mínimo de situação final, sem nome, telefone ou endereço. |

Terça-feira continua exclusiva para consulta e compra presencial: não foi liberado delivery nem pedido de retirada online. Um teste fixa uma terça-feira no horário de São Paulo e verifica o bloqueio na API.

## Validação reproduzível

- `npm test`: testes de aplicação, preços existentes, timeout, autenticação, recuperação, diagnóstico, catálogo, terça-feira e acompanhamento.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- SQL local: `npm install --prefix tmp/sql-test --no-save --package-lock=false @electric-sql/pglite` e `node tests/auditoria-sql.mjs`. Executa PostgreSQL em memória com usuários e dados fictícios; verifica negação para visitante/usuário comum, autorização administrativa, Storage/RPC, rollback por preço, idempotência e registro final após exclusão. A fixture de criação usa preço fixo; não substitui teste de todas as migrações históricas e promoções em homologação. O motor serializa chamadas, portanto não simula duas conexões PostgreSQL reais concorrentes.
- Navegação: iniciar `node tests/servidor-falso.mjs`; iniciar Next em desenvolvimento na porta 3100 com `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329`, chaves fictícias, `ADMIN_USER_ID=11111111-1111-4111-8111-111111111111`, `ADMIN_EMAIL=admin@loja.test`. Executar `node tests/auditoria-mobile.mjs` com Playwright disponível (`PLAYWRIGHT_MODULE_PATH` pode indicar o pacote) e Microsoft Edge instalado. Testa viewport 390×844, mensagem após recarga, ausência de abertura automática do WhatsApp, catálogo com falha/recuperação, conclusão e painel com falha/recuperação. Usa sessão fictícia aceita somente pelo servidor de teste.

## Aplicação futura — depende de aprovação

Nada deste PR foi aplicado ao Supabase ou à hospedagem. As permissões efetivas do banco de produção não foram inspecionadas: a vulnerabilidade foi confirmada nas migrações versionadas e a correção foi testada no PostgreSQL local. Não há afirmação de invasão ou de perda de vendas reais.

1. Conferir em homologação o inventário real de políticas, funções privilegiadas, views e buckets. Usar a consulta somente leitura em `supabase/tests/auditoria_permissoes.sql`. Confirmar também que o bucket `resumos-sorteio` está privado. As migrações não presumem que os arquivos antigos representem integralmente produção.
2. Identificar o UUID da conta administradora em Supabase Auth. Configurar `ADMIN_USER_ID` e `ADMIN_EMAIL` com a mesma identidade. Ausência ou divergência fecha o acesso, em vez de liberar outro usuário.
3. Na sessão que aplicará a migração de RLS, definir `SET app.admin_user_id = 'UUID aprovado';`. Sem isso ela falha e reverte a transação. Aplicar as duas migrações de 28/10 somente após aprovação. Revisar todas as funções `SECURITY DEFINER`: o script restringe sua execução a `service_role`, exceto a função de verificação do administrador.
4. Implantar aplicação e migrações de forma coordenada. A nova API exige a função `criar_pedido_conferido` e a coluna `resposta`; sem a migração, bloqueia o checkout com erro recuperável em vez de gravar sem conferência. Clientes com a versão antiga aberta precisam recarregar. Não reverter a segurança do banco para contornar erros.
5. Configurar `ALERT_WEBHOOK_URL` no servidor com um receptor HTTPS que aceite JSON `{text, evento, status}`. Falha no receptor é registrada, mas não impede a compra. A deduplicação é por processo; para limites globais e histórico durável, o receptor deve agrupar eventos. Nenhum webhook real foi acionado nos testes.
6. Para monitoramento independente do navegador: definir `MONITOR_TOKEN` na hospedagem e nos secrets do GitHub, `ALERT_WEBHOOK_URL` nos secrets, `MONITOR_BASE_URL` nas variables e, só após validar, `GUETTO_MONITOR_ENABLED=true`. O workflow vem desativado por condição e não faz deploy. Verifica duas vezes antes de alertar indisponibilidade. Lembra pedidos novos com mais de cinco minutos apenas no expediente, fora de manutenção e terça-feira. GitHub Actions não garante execução exata a cada cinco minutos; para SLA menor, usar monitor externo dedicado com o mesmo endpoint. Lembretes repetem enquanto houver pendência.
7. Testar conta não administradora, compra de teste em homologação, perda de resposta após gravação, preço alterado durante confirmação, duas conexões concorrentes com mesma chave e dispositivos físicos Android/iOS antes de liberar.

Pedidos concluídos e removidos antes da nova migração não podem ter a situação reconstruída com certeza; serão apresentados como não localizados, jamais inferidos como cancelados. Não existe confirmação oficial de envio do WhatsApp nesta integração.

## Referências de implementação

A pasta `node_modules/next/dist/docs/` indicada no AGENTS.md não está presente no Next 15.5.21 instalado. Foram consultadas as páginas oficiais de Route Handlers e `after`, com validação no build instalado:

- https://nextjs.org/docs/app/api-reference/file-conventions/route
- https://nextjs.org/docs/app/api-reference/functions/after
- https://supabase.com/docs/guides/database/postgres/row-level-security
