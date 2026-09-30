"use client";

import { useEffect, useState } from "react";

const INICIO = Date.parse("2026-09-30T00:00:00-03:00");
const FIM = Date.parse("2026-10-01T00:00:00-03:00");

export default function AvisoReajuste({ ativoInicial }: { ativoInicial: boolean }) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const atualizar = () => setAtivo(Date.now() >= INICIO && Date.now() < FIM);
    atualizar();
    const intervalo = window.setInterval(atualizar, 1000);
    window.addEventListener("focus", atualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
    };
  }, []);

  if (!ativo || fechado) return null;

  return (
    <aside role="alert" className="relative border-b-2 border-yellow-300 bg-yellow-400 px-5 py-5 pr-14 text-black">
      <div className="mx-auto max-w-5xl">
        <p className="text-lg font-black sm:text-xl">AVISO: REAJUSTE DE PREÇOS A PARTIR DE AMANHÃ, 01/10</p>
        <p className="mt-2 text-sm leading-relaxed sm:text-base">
          A partir de 1º de outubro, haverá reajuste geral nos preços de todos os produtos.
          Devido ao aumento no custo das mercadorias, esse ajuste é necessário para manter
          a qualidade dos nossos produtos e do nosso delivery.
        </p>
        <p className="mt-2 text-sm font-bold">Agradecemos pela compreensão e pela confiança!</p>
      </div>
      <button type="button" onClick={() => setFechado(true)} aria-label="Fechar aviso de reajuste"
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg text-2xl hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-black">
        ×
      </button>
    </aside>
  );
}
