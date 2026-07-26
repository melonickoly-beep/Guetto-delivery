import type { Metadata } from "next";
import Image from "next/image";
import Catalogo from "@/components/Catalogo";
import Manutencao from "@/components/Manutencao";
import { SITE_EM_MANUTENCAO } from "@/lib/site-config";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = SITE_EM_MANUTENCAO
  ? {
      title: "Guetto Delivery",
      description: "Site temporariamente em manutenção.",
      robots: { index: false, follow: false, nocache: true },
    }
  : {
      title: "Guetto Delivery | Bebidas, conveniência e tabacaria",
      description:
        "Peça bebidas, gelo, conveniência e itens de tabacaria pelo Guetto Delivery.",
    };

export default async function Home() {
  if (SITE_EM_MANUTENCAO) {
    return <Manutencao />;
  }

  const [
    { data: categorias },
    { data: produtos },
    { data: configuracoes },
  ] = await Promise.all([
    supabase.from("categorias").select("id,nome,icone").order("nome"),
    supabase
      .from("produtos")
      .select(
        "id,categoria_id,nome,descricao,preco,estoque,imagem,destaque,tipo_venda,grupo_estoque,unidades_por_venda,estoque_unidades,estoque_opcoes"
      )
      .eq("disponivel", true)
      .order("nome"),
    supabase
      .from("configuracoes")
      .select("chave,valor")
      .in("chave", [
        "tempo_entrega",
        "horario_abertura",
        "horario_fechamento",
      ]),
  ]);

  const configuracao = new Map(
    (configuracoes ?? []).map((item) => [item.chave, item.valor])
  );
  const tempoEntrega = Number(configuracao.get("tempo_entrega")) || 20;

  return (
    <main className="min-h-screen text-white">
      <section className="border-b border-white/10 px-5 py-7">
        <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-center gap-3 text-center sm:flex-row sm:justify-between sm:gap-5 sm:text-right xl:pr-[21rem]">
          <Image
            src="/images/logo.png"
            alt="Guetto Delivery"
            width={220}
            height={220}
            priority
            className="h-32 w-32 shrink-0 object-contain sm:h-40 sm:w-40"
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
              Delivery
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">
              Bebidas, conveniência e mais
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Escolha, monte seu pedido e finalize pelo WhatsApp.
            </p>
          </div>
        </div>
      </section>

      <Catalogo
        categorias={categorias ?? []}
        produtos={produtos ?? []}
        tempoEntrega={tempoEntrega}
        horarioAbertura={configuracao.get("horario_abertura") ?? ""}
        horarioFechamento={configuracao.get("horario_fechamento") ?? ""}
      />

      <footer className="border-t border-white/10 bg-black/35 px-5 py-8 xl:pr-[21rem]">
        <div className="mx-auto grid max-w-6xl gap-6 text-sm text-zinc-300 sm:grid-cols-3">
          <div>
            <p className="font-black text-yellow-400">Entrega</p>
            <p className="mt-2">Paranacity e Cruzeiro do Sul</p>
            <p>Sem taxa de entrega · respeitando o pedido mínimo</p>
          </div>
          <div>
            <p className="font-black text-yellow-400">Pagamento</p>
            <p className="mt-2">Pix, dinheiro, cartão de crédito ou débito</p>
          </div>
          <div>
            <p className="font-black text-yellow-400">Atendimento</p>
            <p className="mt-2">
              Das {configuracao.get("horario_abertura") ?? "--:--"} às{" "}
              {configuracao.get("horario_fechamento") ?? "--:--"}
            </p>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/554491271708?text=Olá!%20Preciso%20de%20ajuda%20com%20meu%20pedido."
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-24 left-4 z-30 rounded-full bg-green-500 px-4 py-3 text-sm font-black text-black shadow-2xl transition hover:bg-green-400 xl:bottom-5"
      >
        💬 Ajuda no WhatsApp
      </a>
    </main>
  );
}
