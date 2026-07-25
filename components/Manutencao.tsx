import Image from "next/image";

export default function Manutencao() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-white">
      <section className="max-w-xl text-center">
        <Image
          src="/images/logo.png"
          alt="Guetto Delivery"
          width={240}
          height={240}
          priority
          className="mx-auto"
        />
        <h1 className="mt-7 text-3xl font-black text-yellow-400">
          Estamos preparando novidades
        </h1>
        <p className="mt-3 text-lg text-white/80">
          Nosso delivery estará disponível em breve.
        </p>
      </section>
    </main>
  );
}
