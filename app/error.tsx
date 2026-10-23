"use client";
import { useEffect } from "react";
import Link from "next/link";
import { registrarErroCliente } from "@/lib/erros-cliente";
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { registrarErroCliente("tela", error); }, [error]);
  return <main className="min-h-screen px-5 py-12 text-center text-white">
    <h1 className="text-2xl font-bold">Não conseguimos abrir esta tela.</h1>
    <p className="mt-4">Confira sua internet e toque no botão abaixo.</p>
    <button onClick={reset} className="mt-6 rounded-xl bg-yellow-400 px-6 py-4 font-bold text-black">Tentar novamente</button>
    <Link href="/" className="mt-6 block underline">Voltar ao cardápio</Link>
  </main>;
}
