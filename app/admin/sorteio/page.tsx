"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ItemResumo = {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  escolhas_combo?: Record<string, string | string[]> | null;
};

type Participante = {
  pedido_id: string;
  criado_em: string;
  cliente_nome: string;
  telefone: string;
  itens: ItemResumo[];
  total: number;
};

const hojeEmSaoPaulo = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const escaparCsv = (valor: unknown) =>
  `"${String(valor ?? "").replaceAll('"', '""')}"`;

function escolhasDoItem(item: ItemResumo) {
  return Object.entries(item.escolhas_combo ?? {})
    .map(([nome, valor]) =>
      `${nome}: ${Array.isArray(valor) ? valor.join(", ") : valor}`
    )
    .join("; ");
}

export default function SorteioPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(hojeEmSaoPaulo);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (window.sessionStorage.getItem("guetto_admin_desbloqueado") !== "1") {
      router.replace("/admin");
      return;
    }
    setVerificando(false);
  }, [router]);

  useEffect(() => {
    if (verificando) return;

    const carregarResumo = async () => {
      setCarregando(true);
      setErro("");
      const resposta = await fetch(
        `/api/admin/sorteio?data=${encodeURIComponent(dataSelecionada)}`,
        { cache: "no-store" }
      );
      const resultado = await resposta.json().catch(() => null);
      setCarregando(false);

      if (!resposta.ok) {
        setErro(resultado?.error ?? "Não foi possível carregar o resumo.");
        return;
      }

      setParticipantes(resultado?.participantes ?? []);
    };

    void carregarResumo();
  }, [dataSelecionada, verificando]);

  function baixarCsv() {
    const cabecalho = ["Número", "Horário", "Nome", "Telefone", "Pedido", "Total"];
    const linhas = participantes.map((participante, indice) => [
      indice + 1,
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(participante.criado_em)),
      participante.cliente_nome,
      participante.telefone,
      participante.itens
        .map((item) => {
          const escolhas = escolhasDoItem(item);
          return `${item.quantidade}x ${item.nome}${escolhas ? ` (${escolhas})` : ""}`;
        })
        .join(" | "),
      Number(participante.total).toFixed(2).replace(".", ","),
    ]);
    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map(escaparCsv).join(";"))
      .join("\r\n");
    const arquivo = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sorteio-${dataSelecionada}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function excluirResumo() {
    if (
      participantes.length === 0 ||
      !confirm(
        `Excluir definitivamente o resumo de ${dataSelecionada} com ${participantes.length} participante(s)?`
      )
    ) {
      return;
    }

    const resposta = await fetch(
      `/api/admin/sorteio?data=${encodeURIComponent(dataSelecionada)}`,
      { method: "DELETE" }
    );
    const resultado = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      alert(resultado?.error ?? "Não foi possível excluir o resumo.");
      return;
    }
    setParticipantes([]);
  }

  if (verificando) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-zinc-400">
        Verificando acesso...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-400">
              Área privada
            </p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">
              Resumo para sorteio
            </h1>
            <p className="mt-2 text-zinc-400">
              Clientes numerados por ordem de horário, separados por dia.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-700 px-4 py-2 font-bold hover:bg-zinc-800"
            >
              Voltar ao painel
            </Link>
            <Link
              href="/admin/estoque"
              className="rounded-lg border border-zinc-700 px-4 py-2 font-bold hover:bg-zinc-800"
            >
              Estoque
            </Link>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 print:border-black print:bg-white print:text-black">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex flex-col gap-2 font-bold print:hidden">
              Dia do sorteio
              <input
                type="date"
                value={dataSelecionada}
                onChange={(event) => setDataSelecionada(event.target.value)}
                className="rounded-lg bg-zinc-800 px-4 py-3"
              />
            </label>
            <div>
              <p className="text-sm text-zinc-400 print:text-zinc-700">
                Data selecionada
              </p>
              <p className="text-2xl font-black">{dataSelecionada}</p>
              <p className="text-yellow-300 print:text-black">
                {participantes.length} participante(s)
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={baixarCsv}
                disabled={participantes.length === 0}
                className="rounded-lg bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-40"
              >
                Baixar arquivo CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={participantes.length === 0}
                className="rounded-lg border border-zinc-600 px-4 py-3 font-bold hover:bg-zinc-800 disabled:opacity-40"
              >
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => void excluirResumo()}
                disabled={participantes.length === 0}
                className="rounded-lg border border-red-700 px-4 py-3 font-bold text-red-300 hover:bg-red-950 disabled:opacity-40"
              >
                Excluir este dia
              </button>
            </div>
          </div>
        </section>

        {erro && (
          <div className="mb-6 rounded-xl border border-red-700 bg-red-950 p-4 text-red-200">
            {erro}
          </div>
        )}

        {carregando ? (
          <p className="rounded-xl bg-zinc-900 p-6 text-zinc-400">
            Carregando resumo...
          </p>
        ) : participantes.length === 0 ? (
          <p className="rounded-xl bg-zinc-900 p-6 text-zinc-400">
            Nenhum pedido válido registrado neste dia.
          </p>
        ) : (
          <div className="space-y-3">
            {participantes.map((participante, indice) => (
              <article
                key={participante.pedido_id}
                className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:grid-cols-[72px_1fr_auto] print:border-black print:bg-white print:text-black"
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-yellow-400 text-2xl font-black text-black">
                  {indice + 1}
                </div>
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-xl font-black">
                      {participante.cliente_nome}
                    </h2>
                    <span className="text-sm text-zinc-400 print:text-zinc-700">
                      {new Intl.DateTimeFormat("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      }).format(new Date(participante.criado_em))}
                    </span>
                  </div>
                  <a
                    href={`https://wa.me/55${participante.telefone.replace(/\D/g, "").replace(/^55/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-bold text-green-400 print:text-black"
                  >
                    {participante.telefone}
                  </a>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300 print:text-black">
                    {participante.itens.map((item, itemIndice) => {
                      const escolhas = escolhasDoItem(item);
                      return (
                        <li key={`${item.nome}-${itemIndice}`}>
                          {item.quantidade}x {item.nome}
                          {escolhas ? ` — ${escolhas}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <strong className="text-xl text-yellow-300 print:text-black">
                  {moeda.format(Number(participante.total))}
                </strong>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
