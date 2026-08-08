import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidade | Guetto Delivery",
  description:
    "Saiba como a Guetto Delivery utiliza os dados informados nos pedidos.",
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen px-5 py-10 text-white">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-zinc-950/90 p-6 shadow-2xl sm:p-10">
        <Link
          href="/"
          className="text-sm font-bold text-yellow-400 hover:text-yellow-300"
        >
          ← Voltar ao cardápio
        </Link>

        <p className="mt-8 text-sm font-bold tracking-[0.2em] text-yellow-400">
          GUETTO DELIVERY
        </p>
        <h1 className="mt-2 text-3xl font-black">
          Privacidade e dados armazenados
        </h1>
        <p className="mt-3 text-zinc-400">Última atualização: 06/08/2026.</p>

        <div className="mt-8 space-y-8 leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">
              Dados usados no pedido
            </h2>
            <p className="mt-2">
              Para registrar e entregar seu pedido, utilizamos nome, telefone,
              endereço, referência, cidade, itens escolhidos e forma de
              pagamento. Essas informações são enviadas à Guetto Delivery pelo
              sistema e pelo WhatsApp para atendimento, preparo e entrega.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Exclusão após a entrega e resumo promocional
            </h2>
            <p className="mt-2">
              Quando o pedido é marcado como concluído, o registro operacional
              com endereço, referência e pagamento é excluído automaticamente.
              Para ações promocionais e sorteios, mantemos em uma área privada
              do painel um resumo separado com data e horário, nome, telefone,
              itens e total do pedido. Esse resumo não guarda endereço,
              referência ou forma de pagamento e pode ser excluído por dia
              pelo administrador após o encerramento da ação.
            </p>
            <p className="mt-2">
              Isso não apaga os dados que o cliente escolheu salvar no próprio
              aparelho para preencher pedidos futuros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Dados salvos no seu aparelho
            </h2>
            <p className="mt-2">
              Se você marcar “Salvar meus dados neste aparelho”, nome,
              telefone e endereço ficam armazenados apenas no navegador usado,
              por meio do armazenamento local. A opção serve para preencher
              pedidos futuros e pode ser desativada a qualquer momento.
            </p>
            <p className="mt-2">
              O carrinho e o histórico de pedidos também podem ser mantidos no
              navegador. O histórico guarda data, itens, total e código de
              acompanhamento para permitir consultar ou repetir uma compra.
              Esses dados não incluem senha, endereço ou informação de cartão.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Cookies essenciais
            </h2>
            <p className="mt-2">
              O acesso ao painel administrativo utiliza cookies técnicos de
              autenticação. Eles são necessários para manter a sessão segura e
              não são usados para publicidade. O site não utiliza cookies de
              anúncios ou rastreamento de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Como apagar os dados do aparelho
            </h2>
            <p className="mt-2">
              No carrinho, desmarque a opção de salvar ou use o botão “Apagar
              meus dados salvos”. Na página “Meus pedidos”, use “Limpar
              histórico” para apagar os pedidos guardados neste aparelho.
              Também é possível limpar os dados deste site nas configurações do
              navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Dúvidas e solicitações
            </h2>
            <p className="mt-2">
              Para corrigir informações ou solicitar esclarecimentos sobre um
              pedido, entre em contato diretamente com a Guetto Delivery pelo
              WhatsApp.
            </p>
            <a
              href="https://wa.me/554491271708?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20privacidade%20e%20meus%20dados."
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-green-500 px-5 py-3 font-black text-black transition hover:bg-green-400"
            >
              Falar pelo WhatsApp
            </a>
          </section>
        </div>
      </article>
    </main>
  );
}
