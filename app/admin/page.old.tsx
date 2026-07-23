import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");

  return (
    <main className="min-h-screen bg-[#111111] text-white">

      <header className="py-8 flex justify-center">
        <Image
          src="/logo.png"
          alt="Guetto Delivery"
          width={180}
          height={180}
          priority
        />
      </header>

      <section className="max-w-6xl mx-auto px-6">

        <h1 className="text-4xl font-bold text-yellow-400 mb-8">
          Categorias
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">

          {categorias?.map((categoria) => (
            <div
              key={categoria.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-yellow-400 transition"
            >
              <h2 className="text-xl font-semibold">
                {categoria.nome}
              </h2>
            </div>
          ))}

        </div>

      </section>

    </main>
  );
}