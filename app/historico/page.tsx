"use client";

import Link from "next/link";
import { Clock3, History, RotateCcw, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type EscolhasCombo = {
  askov?: string;
  energetico?: string;
  gelos?: string[];
  whisky?: string;
};

type ItemHistorico = {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
  sabor?: string;
  escolhasCombo?: EscolhasCombo;
};

type PedidoHistorico = {
  id: string;
  criado_em: string;
  total: number;
  itens: ItemHistorico[];
};

const formatarPreco = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const calcularSubtotal = (item: ItemHistorico) => {
  if (item.nome.trim().toLowerCase() === "seda zomo") {
    const trios = Math.floor(item.quantidade / 3);
    return trios * 10 + (item.quantidade % 3) * Number(item.preco);
  }

  return Number(item.preco) * Number(item.quantidade);
};

function lerHistorico(): PedidoHistorico[] {
  try {
    const salvo = JSON.parse(
      window.localStorage.getItem("guetto_historico_pedidos") ?? "[]"
    ) as PedidoHistorico[];

    return Array.isArray(salvo)
      ? salvo.filter(
          (pedido) =>
            pedido &&
            typeof pedido.id === "string" &&
            Array.isArray(pedido.itens)
        )
      : [];
  } catch {
    return [];
  }
}

function detalhesItem(item: ItemHistorico) {
  const detalhes: string[] = [];
  if (item.sabor) detalhes.push(`Sabor: ${item.sabor}`);

  const escolhas = item.escolhasCombo;
  if (escolhas?.askov) detalhes.push(`Askov: ${escolhas.askov}`);
  if (escolhas?.energetico)
    detalhes.push(`Energético: ${escolhas.energetico}`);
  if (escolhas?.gelos?.length)
    detalhes.push(`Gelos: ${escolhas.gelos.join(", ")}`);
  if (escolhas?.whisky) {
    detalhes.push(
      item.nome.toLowerCase().includes("gin eternity")
        ? `Gin Eternity: ${escolhas.whisky}`
        : `Whisky: ${escolhas.whisky}`
    );
  }

  return detalhes;
}

export default function HistoricoPage() {
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const historico = lerHistorico();

    try {
      const ultimoPedidoId = window.localStorage.getItem(
        "guetto_ultimo_pedido_id"
      );
      const ultimoPedidoSalvo = window.localStorage.getItem(
        "guetto_ultimo_pedido"
      );

      if (
        ultimoPedidoId &&
        ultimoPedidoSalvo &&
        !historico.some((pedido) => pedido.id === ultimoPedidoId)
      ) {
        const itens = JSON.parse(ultimoPedidoSalvo) as ItemHistorico[];
        if (Array.isArray(itens) && itens.length > 0) {
          const criadoEm =
            window.localStorage.getItem("guetto_ultimo_pedido_criado_em") ?? "";
          historico.push({
            id: ultimoPedidoId,
            criado_em: criadoEm,
            total: itens.reduce(
              (total, item) => total + calcularSubtotal(item),
              0
            ),
            itens: itens.map((item) => ({
              id: item.id,
              nome: item.nome,
              quantidade: Number(item.quantidade),
              preco: Number(item.preco),
              sabor: item.sabor,
              escolhasCombo: item.escolhasCombo,
            })),
          });
        }
      }
    } catch {
      // Mantém os registros válidos mesmo se o último pedido estiver corrompido.
    }

    const ordenado = historico.sort((a, b) => {
      if (!a.criado_em) return 1;
      if (!b.criado_em) return -1;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
    window.localStorage.setItem(
      "guetto_historico_pedidos",
      JSON.stringify(ordenado)
    );
    setPedidos(ordenado);
    setCarregado(true);
  }, []);

  function refazerPedido(pedido: PedidoHistorico) {
    const carrinhoAtual = window.localStorage.getItem("guetto_carrinho");
    if (
      carrinhoAtual &&
      carrinhoAtual !== "[]" &&
      !window.confirm(
        "Seu carrinho atual será substituído por este pedido. Deseja continuar?"
      )
    ) {
      return;
    }

    window.localStorage.setItem("guetto_carrinho", JSON.stringify(pedido.itens));
    window.localStorage.setItem("guetto_abrir_carrinho", "1");
    window.location.assign("/");
  }

  function limparHistorico() {
    if (
      !window.confirm(
        "Deseja apagar todo o histórico de pedidos salvo neste aparelho?"
      )
    ) {
      return;
    }

    window.localStorage.removeItem("guetto_historico_pedidos");
    setPedidos([]);
  }

  return (
    <main className="min-h-screen px-4 py-8 text-white sm:px-5 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-bold text-yellow-400 hover:text-yellow-300"
        >
          ← Voltar ao cardápio
        </Link>

        <section className="mt-5 rounded-3xl border border-white/10 bg-zinc-950/90 p-5 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-yellow-400">
                GUETTO DELIVERY
              </p>
              <h1 className="mt-2 flex items-center gap-3 text-3xl font-black">
                <History className="text-yellow-400" aria-hidden="true" />
                Meus pedidos
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Histórico salvo somente neste aparelho.
              </p>
            </div>

            {pedidos.length > 0 && (
              <button
                type="button"
                onClick={limparHistorico}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/50 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10"
              >
                <Trash2 size={17} aria-hidden="true" />
                Limpar histórico
              </button>
            )}
          </div>

          {carregado && pedidos.length === 0 && (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-7 text-center">
              <ShoppingBag
                className="mx-auto text-zinc-500"
                size={42}
                aria-hidden="true"
              />
              <h2 className="mt-4 text-xl font-black">
                Você ainda não fez pedidos neste aparelho
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Seus próximos pedidos aparecerão aqui automaticamente.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-black text-black transition hover:bg-yellow-300"
              >
                Fazer um pedido
              </Link>
            </div>
          )}

          <div className="mt-8 space-y-5">
            {pedidos.map((pedido, indicePedido) => (
              <article
                key={pedido.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                  <div>
                    <p className="font-black text-yellow-300">
                      Pedido #{pedidos.length - indicePedido}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                      <Clock3 size={15} aria-hidden="true" />
                      {pedido.criado_em
                        ? new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Sao_Paulo",
                          }).format(new Date(pedido.criado_em))
                        : "Pedido anterior salvo neste aparelho"}
                    </p>
                  </div>
                  <p className="text-xl font-black text-yellow-400">
                    {formatarPreco(Number(pedido.total))}
                  </p>
                </div>

                <ul className="mt-4 space-y-3">
                  {pedido.itens.map((item, indiceItem) => {
                    const detalhes = detalhesItem(item);
                    return (
                      <li
                        key={`${item.id}-${item.sabor ?? ""}-${indiceItem}`}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <div>
                          <p className="font-bold text-zinc-100">
                            {item.quantidade}x {item.nome}
                          </p>
                          {detalhes.length > 0 && (
                            <p className="mt-1 text-xs text-zinc-400">
                              {detalhes.join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-zinc-300">
                          {formatarPreco(calcularSubtotal(item))}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                  <Link
                    href={`/acompanhar/${pedido.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-400 px-4 py-2.5 text-sm font-black text-blue-200 transition hover:bg-blue-400/10 sm:flex-none"
                  >
                    <Clock3 size={17} aria-hidden="true" />
                    Acompanhar pedido
                  </Link>
                  <button
                    type="button"
                    onClick={() => refazerPedido(pedido)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-black text-black transition hover:bg-yellow-300 sm:flex-none"
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    Refazer pedido
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
