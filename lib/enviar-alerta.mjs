// Uso exclusivo no servidor e no monitor; nunca importar em componentes de cliente.
export function alertaConfigurado(env = process.env) {
  return Boolean((env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) || env.ALERT_WEBHOOK_URL?.startsWith('https://'));
}

function mensagemEmPortugues(codigo) {
  if (codigo === 'cliente_recurso_critico') return ['Falha ao carregar arquivo essencial da loja', 'Um navegador não conseguiu carregar um arquivo JavaScript ou CSS necessário à página. Isso pode impedir o uso da loja. Verifique o catálogo e a conexão.'];
  if (codigo === 'teste_email') return ['Teste dos alertas', 'Este é um teste dos alertas da Guetto Delivery. Nenhum pedido foi criado ou alterado.'];
  if (codigo === 'pedido_novo_aguardando_mais_de_5_minutos') return ['Pedido aguardando atendimento', 'Há pedido novo aguardando há mais de cinco minutos. Abra o painel para conferir e atender.'];
  if (codigo === 'catalogo_ou_api_indisponivel_em_duas_verificacoes') return ['Possível indisponibilidade da loja', 'Duas verificações seguidas falharam. Confira se o catálogo abre e se o painel está funcionando.'];
  if (codigo === 'admin_acesso_negado') return ['Acesso administrativo recusado', 'Uma tentativa de acesso administrativo foi recusada. Isso também pode ocorrer quando a sessão expira; não confirma uma invasão.'];
  if (codigo.startsWith('acompanhamento')) return ['Falha no acompanhamento do pedido', 'Não foi possível consultar a situação de um pedido. Isso não significa que ele foi cancelado. Confira o painel.'];
  if (/catalogo/.test(codigo)) return ['Problema no catálogo', 'Ocorreu uma falha ao carregar ou atualizar produtos. Confira o catálogo e o painel antes de repetir uma alteração.'];
  if (/painel/.test(codigo)) return ['Problema no painel administrativo', 'O painel apresentou falha de consulta, conexão ou atualização. Confira os pedidos e a conexão. Uma alteração pode já ter sido salva.'];
  if (/pedido|checkout/.test(codigo)) return ['Problema na confirmação de pedido', 'Ocorreu uma falha durante o registro ou a consulta da confirmação de um pedido. Confira no painel se ele foi registrado antes de orientar um novo envio.'];
  return ['Falha detectada na loja', 'O sistema registrou uma falha. Confira o funcionamento da loja e do painel administrativo.'];
}

export async function enviarAlerta(evento, status = 500, env = process.env, requisitar = fetch) {
  const codigo = evento.replace(/[^a-z0-9_]/gi, '').slice(0, 80);
  const [titulo, mensagem] = mensagemEmPortugues(codigo);
  const situacao = status === null ? 'status HTTP não informado' : `status ${status}`;
  const texto = `${mensagem}\n\nReferência para suporte: ${codigo} (${situacao}).\nNenhum dado de cliente acompanha este aviso.`;
  const email = Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM);
  const url = email ? 'https://api.resend.com/emails' : env.ALERT_WEBHOOK_URL;
  if (!url?.startsWith('https://')) throw new Error('Destino de alerta não configurado');
  const headers = { 'Content-Type': 'application/json' };
  if (email) {
    headers.Authorization = `Bearer ${env.RESEND_API_KEY}`;
    // Agrupa o mesmo incidente por cinco minutos entre instâncias do servidor.
    headers['Idempotency-Key'] = `guetto-${codigo}-${status}-${Math.floor(Date.now() / 300000)}`;
  }
  const body = email ? {
    from: env.ALERT_EMAIL_FROM, to: [env.ALERT_EMAIL_TO],
    subject: `Guetto Delivery — ${titulo}`, text: texto,
  } : { text: texto, evento: codigo, status };
  const resposta = await requisitar(url, {
    method: 'POST', headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  // Não registrar resposta do provedor: pode conter endereços ou informações da conta.
  if (!resposta.ok) throw new Error('Falha na entrega do alerta');
}
