import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChefHat, Clock3, PackageCheck, Truck } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import RepetirPedidoButton from "@/components/RepetirPedidoButton";

export const dynamic = "force-dynamic";

type ItemPedido = {
  produto_id: string;
  nome: string;
  quantidade: number;
  escolhas_combo?: {
    sabor?: string;
    askov?: string;
    energetico?: string;
    gelos?: string[];
    whisky?: string;
  } | null;
};

const etapas = [
  { valor: "novo", rotulo: "Pedido recebido", icone: Clock3 },
  { valor: "em_preparo", rotulo: "Em preparo", icone: ChefHat },
  { valor: "saiu_para_entrega", rotulo: "Saiu para entrega", icone: Truck },
  { valor: "concluido", rotulo: "Entregue", icone: PackageCheck },
];

export default async function AcompanharPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: pedido } = await supabaseAdmin
    .from("pedidos")
    .select("id, created_at, itens, total, status")
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const indiceAtual = etapas.findIndex((etapa) => etapa.valor === pedido.status);
  const cancelado = pedido.status === "cancelado";
  const itens = (pedido.itens ?? []) as ItemPedido[];
  const idsProdutos = [...new Set(itens.map((item) => item.produto_id).filter(Boolean))];
  const { data: produtosAtuais } = idsProdutos.length
    ? await supabaseAdmin
        .from("produtos")
        .select(
          "id, categoria_id, nome, descricao, preco, estoque, imagem, destaque, tipo_venda, grupo_estoque, unidades_por_venda, estoque_unidades, estoque_opcoes"
        )
        .in("id", idsProdutos)
    : { data: [] };
  const produtosPorId = new Map(
    (produtosAtuais ?? []).map((produto) => [produto.id, produto])
  );
  const itensParaRepetir = itens.flatMap((item) => {
    const produto = produtosPorId.get(item.produto_id);
    if (!produto) return [];

    const sabor = item.escolhas_combo?.sabor;
    const estoqueGeral =
      produto.grupo_estoque && typeof produto.estoque_unidades === "number"
        ? Math.floor(
            produto.estoque_unidades / (produto.unidades_por_venda || 1)
          )
        : produto.estoque;
    const estoqueDisponivel =
      sabor && produto.estoque_opcoes
        ? Number(produto.estoque_opcoes[sabor] ?? 0)
        : estoqueGeral;
    const quantidade = Math.min(item.quantidade, estoqueDisponivel);
    if (quantidade < 1) return [];

    const escolhasCombo =
      item.escolhas_combo && !sabor
        ? {
            askov: item.escolhas_combo.askov,
            energetico: item.escolhas_combo.energetico ?? "",
            gelos: item.escolhas_combo.gelos ?? [],
            whisky: item.escolhas_combo.whisky,
          }
        : undefined;

    return [
      {
        ...produto,
        quantidade,
        ...(sabor ? { sabor } : {}),
        ...(escolhasCombo ? { escolhasCombo } : {}),
      },
    ];
  });
  const quantidadeOriginal = itens.reduce(
    (total, item) => total + item.quantidade,
    0
  );
  const quantidadeDisponivel = itensParaRepetir.reduce(
    (total, item) => total + item.quantidade,
    0
  );

  return (
    <main className="min-h-screen px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-bold text-yellow-400 hover:text-yellow-300">
          ← Voltar ao cardápio
        </Link>

        <section className="mt-5 rounded-3xl border border-white/10 bg-zinc-950/90 p-6 shadow-2xl sm:p-8">
          <p className="text-sm font-bold tracking-[0.2em] text-yellow-400">GUETTO DELIVERY</p>
          <h1 className="mt-2 text-3xl font-black">Acompanhe seu pedido</h1>
          <p className="mt-2 text-zinc-400">
            Pedido feito em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            }).format(new Date(pedido.created_at))}
          </p>

          {cancelado ? (
            <div className="mt-7 rounded-2xl border border-red-500/50 bg-red-950/50 p-5">
              <p className="text-xl font-black text-red-200">Pedido cancelado</p>
              <p className="mt-1 text-sm text-red-100/80">
                Entre em contato com a Guetto Delivery se precisar de ajuda.
              </p>
            </div>
          ) : (
            <ol className="mt-8 space-y-3">
              {etapas.map((etapa, indice) => {
                const concluida = indice <= indiceAtual;
                const Icone = etapa.icone;
                return (
                  <li
                    key={etapa.valor}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      concluida
                        ? "border-yellow-400/60 bg-yellow-400/10"
                        : "border-zinc-800 bg-zinc-900/70 text-zinc-500"
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                        concluida ? "bg-yellow-400 text-black" : "bg-zinc-800"
                      }`}
                    >
                      {indice < indiceAtual ? <Check size={22} /> : <Icone size={22} />}
                    </span>
                    <span className="font-bold">{etapa.rotulo}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-8 border-t border-zinc-800 pt-6">
            <h2 className="text-lg font-black">Resumo</h2>
            <ul className="mt-3 space-y-2 text-zinc-300">
              {itens.map((item, indice) => (
                <li key={`${item.nome}-${indice}`}>
                  {item.quantidade}x {item.nome}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-2xl font-black text-yellow-400">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(Number(pedido.total))}
            </p>
            <RepetirPedidoButton
              itens={itensParaRepetir}
              teveAjustes={quantidadeDisponivel < quantidadeOriginal}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
