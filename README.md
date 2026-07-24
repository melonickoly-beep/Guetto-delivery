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
os produtos, preços e estoque no servidor, registra o pedido e então abre o
WhatsApp para o cliente confirmar o envio. O painel permite acompanhar e alterar
o status dos pedidos.
