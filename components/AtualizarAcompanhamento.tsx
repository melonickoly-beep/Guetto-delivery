"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AtualizarAcompanhamento() {
  const router = useRouter();
  const [atualizando, iniciarAtualizacao] = useTransition();

  useEffect(() => {
    const atualizar = () => {
      if (!atualizando && navigator.onLine && document.visibilityState === "visible") {
        iniciarAtualizacao(() => router.refresh());
      }
    };
    const intervalo = window.setInterval(atualizar, 15_000);
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("online", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [router, atualizando]);

  return <p className="mt-4 text-sm text-zinc-400" role="status">
    {atualizando ? "Atualizando situação…" : "Esta página atualiza automaticamente a cada 15 segundos enquanto estiver aberta e conectada."}
  </p>;
}
