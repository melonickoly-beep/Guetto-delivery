import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Guetto Delivery",
  description: "Site temporariamente em manutenção.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-white">
      <section className="max-w-xl text-center">
        <Image
          src="/images/logo.png"
          alt="Guetto Delivery"
          width={280}
          height={280}
          priority
          className="mx-auto"
        />

        <h1 className="mt-8 text-3xl font-bold text-yellow-400">
          Estamos preparando novidades
        </h1>
        <p className="mt-3 text-lg text-white/80">
          Nosso delivery estará disponível em breve.
        </p>
      </section>
    </main>
  );
}
