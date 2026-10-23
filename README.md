# Guetto Delivery

Cardápio e recebimento de pedidos da Guetto Delivery, desenvolvido com Next.js
15, React 19 e Supabase.

## Requisitos

- Node.js 20 ou mais recente
- Um projeto Supabase configurado
- Conta administrativa criada no Supabase Auth

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha as chaves do Supabase e o e-mail da conta administrativa.
3. Instale e execute:

```bash
npm install
npm run dev
```

O catálogo fica em `http://localhost:3000` e o painel em
`http://localhost:3000/admin`.

## Verificação antes de publicar

```bash
npm run check
```

Configure na hospedagem as mesmas quatro variáveis descritas em `.env.example`.
A variável `SUPABASE_SERVICE_ROLE_KEY` é secreta e nunca deve ser exposta no
navegador. Cadastre o estoque real antes de liberar os produtos para venda.

## Fluxo do pedido

O navegador envia somente identificadores e quantidades. A API valida novamente
os produtos, preços e estoque no servidor e registra o pedido diretamente no
painel. Em seguida, o site abre o WhatsApp com o pedido completo para o cliente
enviar obrigatoriamente à loja. O painel permite acompanhar e alterar o status
dos pedidos.

### Diagnóstico de falhas no celular

Os eventos do navegador chegam a `POST /api/erros-cliente` e aparecem nos logs
privados da função do Next.js na Netlify. Procure por `"evento":"erro_cliente"`.
O registro informa etapa/tipo, página normalizada, família do navegador e sistema,
status HTTP e, quando disponível, arquivo JavaScript/posição ou digest do Next.js.
Não inclui mensagens completas, dados do pedido, código de acompanhamento ou
identificadores persistentes do cliente. Há deduplicação e limite de cinco eventos
por carregamento, além de limite de tamanho e de eventos por instância no servidor.

A coleta é de melhor esforço: não detecta falhas anteriores ao carregamento do
JavaScript e pode não chegar ao servidor sem internet. Os logs seguem a retenção
do plano da hospedagem; esta implementação não envia alertas automáticos.
