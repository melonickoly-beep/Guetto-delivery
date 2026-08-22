"use client";

import { Download, Share2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISPENSADO_EM = "guetto-pwa-dispensado-em";
const ESPERA_PARA_REEXIBIR = 14 * 24 * 60 * 60 * 1000;

export default function PwaRegistro() {
  const pathname = usePathname();
  const [promptInstalacao, setPromptInstalacao] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarAjudaManual, setMostrarAjudaManual] = useState(false);
  const [plataforma, setPlataforma] = useState<"android" | "ios" | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registro) => registro.update())
        .catch(() => undefined);
    }

    const modoStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (modoStandalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const android = /android/i.test(navigator.userAgent);
    setPlataforma(ios ? "ios" : android ? "android" : null);

    const dispensadoEm = Number(localStorage.getItem(DISPENSADO_EM) ?? 0);
    if (!android && Date.now() - dispensadoEm < ESPERA_PARA_REEXIBIR) return;

    const aoSolicitarInstalacao = (event: Event) => {
      event.preventDefault();
      setPromptInstalacao(event as BeforeInstallPromptEvent);
      setMostrarAjudaManual(false);
      setVisivel(true);
    };

    const aoInstalar = () => {
      setPromptInstalacao(null);
      setVisivel(false);
    };

    window.addEventListener("beforeinstallprompt", aoSolicitarInstalacao);
    window.addEventListener("appinstalled", aoInstalar);

    if (android) {
      setVisivel(true);
    }

    if (ios) {
      const timer = window.setTimeout(() => setVisivel(true), 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", aoSolicitarInstalacao);
        window.removeEventListener("appinstalled", aoInstalar);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", aoSolicitarInstalacao);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  function fechar() {
    localStorage.setItem(DISPENSADO_EM, String(Date.now()));
    setVisivel(false);
    setMostrarAjudaManual(false);
  }

  async function instalar() {
    if (!promptInstalacao) {
      setMostrarAjudaManual(true);
      return;
    }

    await promptInstalacao.prompt();
    const escolha = await promptInstalacao.userChoice;
    if (escolha.outcome === "accepted") {
      setVisivel(false);
    }
    setPromptInstalacao(null);
  }

  if (!visivel || pathname.startsWith("/admin") || pathname.startsWith("/login")) {
    return null;
  }

  return (
    <aside
      aria-label="Instalar Guetto Delivery"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-yellow-300/30 bg-zinc-950/95 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur sm:bottom-5"
    >
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar convite de instalação"
        className="absolute right-2 top-2 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
      >
        <X size={18} aria-hidden="true" />
      </button>

      <div className="flex items-center gap-3 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={52}
          height={52}
          className="h-13 w-13 rounded-xl"
        />
        <div>
          <p className="font-black text-yellow-400">Instale o Guetto Delivery</p>
          <p className="mt-0.5 text-sm leading-snug text-zinc-300">
            Acesse o cardápio direto pela tela inicial.
          </p>
        </div>
      </div>

      {mostrarAjudaManual ? (
        <div className="mt-3 rounded-xl bg-white/8 p-3 text-sm text-zinc-200">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Share2 size={17} className="text-yellow-400" aria-hidden="true" />
            {plataforma === "android" ? "No Android" : "No iPhone ou iPad"}
          </p>
          {plataforma === "android" ? (
            <p className="mt-1.5">
              No Chrome, toque no menu de <strong>três pontos</strong> e escolha{" "}
              <strong>Adicionar à tela inicial</strong> ou <strong>Instalar app</strong>.
            </p>
          ) : (
            <p className="mt-1.5">
              Toque em <strong>Compartilhar</strong> no Safari e depois em{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={instalar}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-yellow-300 active:scale-[0.99]"
        >
          {promptInstalacao ? (
            <Download size={18} aria-hidden="true" />
          ) : (
            <Share2 size={18} aria-hidden="true" />
          )}
          {promptInstalacao ? "Instalar aplicativo" : "Ver como instalar"}
        </button>
      )}
    </aside>
  );
}
