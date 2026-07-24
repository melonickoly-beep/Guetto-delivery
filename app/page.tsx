import Image from "next/image";
import Catalogo from "@/components/Catalogo";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  const { data: produtos } = await supabase
    .from("produtos")
    .select("*")
    .eq("disponivel", true)
    .order("nome");

  const { data: configuracaoEntrega } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "tempo_entrega")
    .maybeSingle();

  const { data: configuracaoAbertura } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "horario_abertura")
    .maybeSingle();

  const { data: configuracaoFechamento } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "horario_fechamento")
    .maybeSingle();

  const tempoEntrega = Number(configuracaoEntrega?.valor) || 20;

  return (
    <main className="min-h-screen text-white">
      <section className="py-12 border-b border-white/20">
        <div className="max-w-7xl mx-auto text-center">
          <Image
            src="/images/logo.png"
            alt="Guetto Delivery"
            width={280}
            height={280}
            className="mx-auto"
          />
        </div>
      </section>

      <Catalogo
        categorias={categorias ?? []}
        produtos={produtos ?? []}
        tempoEntrega={tempoEntrega}
        horarioAbertura={configuracaoAbertura?.valor ?? ""}
        horarioFechamento={configuracaoFechamento?.valor ?? ""}
      />
    </main>
  );
}
