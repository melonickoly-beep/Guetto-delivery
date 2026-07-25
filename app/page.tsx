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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
          <Image
            src="/images/logo.png"
            alt="Guetto Delivery"
            width={150}
            height={150}
            priority
            className="h-24 w-24 object-contain sm:h-28 sm:w-28"
          />
          <div className="text-right">
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
    </main>
  );
}
