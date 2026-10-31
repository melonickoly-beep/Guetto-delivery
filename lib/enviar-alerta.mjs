// Uso exclusivo no servidor e no monitor; nunca importar em componentes de cliente.
export function alertaConfigurado(env = process.env) {
  return Boolean((env.RESEND_API_KEY && env.ALERT_EMAIL_TO && env.ALERT_EMAIL_FROM) || env.ALERT_WEBHOOK_URL?.startsWith('https://'));
}

export async function enviarAlerta(evento, status = 500, env = process.env, requisitar = fetch) {
  const codigo = evento.replace(/[^a-z0-9_]/gi, '').slice(0, 80);
  const texto = `Guetto Delivery: ${codigo} (${status}). Verifique o funcionamento da loja e os registros do servidor. Nenhum dado de cliente acompanha este aviso.`;
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
    subject: `Guetto Delivery: alerta ${codigo}`, text: texto,
  } : { text: texto, evento: codigo, status };
  const resposta = await requisitar(url, {
    method: 'POST', headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  // Não registrar resposta do provedor: pode conter endereços ou informações da conta.
  if (!resposta.ok) throw new Error('Falha na entrega do alerta');
}
