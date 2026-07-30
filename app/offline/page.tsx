import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Sem conexão | Guetto Delivery",
};

export default function Offline() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12 text-center">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/85 p-7 shadow-2xl">
        <Image
          src="/images/logo.png"
          alt="Guetto Delivery"
          width={150}
          height={150}
          priority
          className="mx-auto h-32 w-32 object-contain"
        />
        <h1 className="mt-4 text-2xl font-black text-yellow-400">Você está sem internet</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Conecte-se novamente para consultar o cardápio atualizado e fazer seu pedido.
        </p>
        <Link
          href="/"
          className="mt-6 block rounded-xl bg-yellow-400 px-4 py-3 font-black text-zinc-950 transition hover:bg-yellow-300"
        >
          Tentar novamente
        </Link>
      </section>
    </main>
  );
}
