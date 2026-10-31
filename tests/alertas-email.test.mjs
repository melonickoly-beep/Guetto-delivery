import test from 'node:test';
import assert from 'node:assert/strict';
import { alertaConfigurado, enviarAlerta } from '../lib/enviar-alerta.mjs';

const env = { RESEND_API_KEY: 'chave-ficticia', ALERT_EMAIL_TO: 'admin@example.com', ALERT_EMAIL_FROM: 'alertas@example.com' };
test('Resend recebe somente código operacional, com chave protegida e deduplicação', async () => {
  await enviarAlerta('checkout_falhou', 503, env, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer chave-ficticia');
    assert.match(options.headers['Idempotency-Key'], /^guetto-checkout_falhou-503-\d+$/);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.to, ['admin@example.com']);
    assert.equal(payload.from, 'alertas@example.com');
    assert.equal(payload.subject, 'Guetto Delivery — Problema na confirmação de pedido');
    assert.match(payload.text, /Confira no painel se ele foi registrado/);
    assert.ok(!options.body.includes(env.RESEND_API_KEY));
    return new Response('{}');
  });
});
test('configuração incompleta não ativa email e preserva webhook', async () => {
  assert.equal(alertaConfigurado({ RESEND_API_KEY: 'incompleta' }), false);
  await enviarAlerta('catalogo_falhou', 500, { ALERT_WEBHOOK_URL: 'https://example.com/webhook' }, async (url, options) => {
    assert.equal(url, 'https://example.com/webhook');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(JSON.parse(options.body).evento, 'catalogo_falhou');
    return new Response('{}');
  });
});
test('falha do provedor é detectada sem expor resposta nem repetir envio', async () => {
  let chamadas = 0;
  await assert.rejects(enviarAlerta('painel_falhou', 500, env, async () => {
    chamadas++;
    return new Response('detalhe privado', { status: 429 });
  }), { message: 'Falha na entrega do alerta' });
  assert.equal(chamadas, 1);
});
