# Alertas por e-mail

O servidor e o monitor podem usar Resend em lugar do webhook. Configure três variáveis privadas na Netlify: `RESEND_API_KEY` (chave com permissão de envio), `ALERT_EMAIL_TO` (destinatário) e `ALERT_EMAIL_FROM` (remetente do domínio verificado no Resend). Não use prefixo NEXT_PUBLIC e não coloque a chave no repositório ou na conversa.

O endereço `onboarding@resend.dev` serve somente para teste destinado ao e-mail da própria conta Resend; o envio operacional precisa de remetente autorizado. Verifique o domínio no Resend antes de ativar em produção. Uma resposta de aceitação do provedor não prova recebimento: confirme também a entrega no painel e na caixa do destinatário.

Se as três variáveis estiverem preenchidas, Resend tem prioridade. Caso contrário, o webhook continua disponível. Sem nenhum destino completo, apenas os logs locais ficam ativos. Erros de envio nunca bloqueiam o pedido. Mensagens contêm apenas código operacional e status, sem dados de clientes. O provedor deduplica o mesmo código/status em janelas de cinco minutos; instâncias locais também mantêm a proteção de um minuto.

Para o monitor independente, configure as mesmas três variáveis nos secrets do GitHub, além de MONITOR_TOKEN. Defina MONITOR_BASE_URL nas variables e habilite GUETTO_MONITOR_ENABLED apenas depois do teste de envio. A chave e o token não são exibidos nos logs.

Referência: https://resend.com/docs/api-reference/emails/send-email

## Diagnósticos automáticos do painel

Eventos `cliente_painel` ficam somente nos logs privados (`evento: erro_cliente`,
`tipo: painel`) e nos avisos do próprio painel. Timeout do Realtime, conexão local
interrompida e aba suspensa podem gerá-los sem ação do administrador. Ausência de
status permanece `null` no log: não comprova uma resposta HTTP 500.

O coletor aplica esse filtro no servidor, inclusive para abas antigas já abertas.
Falhas confirmadas nas rotas de pedidos/produtos (`painel_patch`, `painel_delete`,
`painel_get`, `pedido_post`, `catalogo_patch` etc.) continuam enviando alertas.
Os demais diagnósticos do cliente e o monitor independente também permanecem ativos.
