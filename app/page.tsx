import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
      <section className="border-b border-white/10 px-5 py-3 sm:py-6">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 text-left sm:gap-5 sm:text-right xl:pr-[21rem]">
          <Image
            src="/images/logo.png"
            alt="Guetto Delivery"
            width={220}
            height={220}
            priority
            className="h-20 w-20 shrink-0 object-contain sm:h-32 sm:w-32"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400 sm:text-sm">
              Delivery
            </p>
            <h1 className="mt-1 text-lg font-black leading-tight sm:text-3xl">
              Bebidas, conveniência e mais
            </h1>
            <p className="mt-1 text-xs text-zinc-300 sm:mt-2 sm:text-sm">
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
            <Link
              href="/privacidade"
              className="mt-2 inline-block font-semibold text-yellow-300 underline underline-offset-4"
            >
              Privacidade e dados
            </Link>
          </div>
        </div>
      </footer>

    </main>
  );
}
