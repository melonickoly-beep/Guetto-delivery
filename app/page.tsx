import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  return (
    <main className="min-h-screen bg-[#111111] text-white">
      <section className="bg-[#111111] py-12 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto text-center">
          <Image
            src="/images/logo.png"
            alt="Guetto Delivery"
            width={280}
            height={280}
            className="mx-auto mb-6"
          />

          <h1 className="text-5xl font-extrabold text-yellow-400">
            Guetto Delivery
          </h1>

          <p className="mt-3 text-xl text-zinc-300">
            Tabacaria • Distribuidora de Bebidas
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto p-8">
        <h2 className="text-3xl font-bold mb-6">Categorias</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categorias?.map((categoria) => (
            <div
              key={categoria.id}
              className="bg-zinc-900 rounded-xl p-6 text-center border border-zinc-800 hover:border-yellow-500 transition"
            >
              <div className="text-4xl mb-3">{categoria.icone}</div>
              <div className="font-semibold">{categoria.nome}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
