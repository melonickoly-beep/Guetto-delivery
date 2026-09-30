"use client";

import { useEffect, type ReactNode } from "react";
import { siteEmManutencao } from "@/lib/site-config";

export default function MonitorManutencao({ ativoInicial, children }: {
  ativoInicial: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    // Recarrega inclusive os preços quando a manutenção termina.
    const conferir = () => {
      if (siteEmManutencao() !== ativoInicial) window.location.reload();
    };
    conferir();
    const intervalo = window.setInterval(conferir, 1000);
    window.addEventListener("focus", conferir);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", conferir);
    };
  }, [ativoInicial]);
  return children;
}
