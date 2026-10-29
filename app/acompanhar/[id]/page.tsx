import { alertarErroCritico } from "@/lib/alertas";
import PwaRegistro from "@/components/PwaRegistro";
import Link from "next/link";
import { Check, ChefHat, Clock3, PackageCheck, Truck } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ItemPedido = {
  nome: string;
  quantidade: number;
};

const etapas = [
  { valor: "novo", rotulo: "Pedido recebido", icone: Clock3 },
  { valor: "em_preparo", rotulo: "Em preparo", icone: ChefHat },
  { valor: "saiu_para_entrega", rotulo: "Saiu para entrega", icone: Truck },
  { valor: "concluido", rotulo: "Entregue", icone: PackageCheck },
];

function AvisoPedido({ titulo, mensagem }: { titulo: string; mensagem: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-yellow-400/40 bg-zinc-950/95 p-7 text-center shadow-2xl sm:p-10">
        <p className="text-sm font-bold tracking-[0.2em] text-yellow-400">
          GUETTO DELIVERY
        </p>
        <div className="mx-auto mt-6 grid h-20 w-20 place-items-center rounded-full bg-yellow-400/20 text-4xl">
          •
        </div>
        <h1 className="mt-5 text-3xl font-black text-yellow-300">
          {titulo}
        </h1>
        <p className="mt-3 text-zinc-300">
          {mensagem}
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-yellow-400 px-6 py-3 font-black text-black transition hover:bg-yellow-300"
        >
          Voltar ao catálogo
        </Link>
      </section>
    </main>
  );
}

export default async function AcompanharPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <AvisoPedido titulo="Link inválido" mensagem="Confira o link de acompanhamento." />;
  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select("id, created_at, itens, total, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    alertarErroCritico("acompanhamento_consulta");
    throw new Error("Não foi possível consultar o pedido. Tente novamente.");
  }
  if (!pedido) {
    const { data: final, error: erroFinal } = await supabaseAdmin.from("pedidos_situacao_final").select("status").eq("pedido_id", id).maybeSingle();
    if (erroFinal) { alertarErroCritico("acompanhamento_final"); throw new Error("Consulta indisponível. Tente novamente."); }
    if (final?.status === "concluido") return <AvisoPedido titulo="Pedido entregue" mensagem="Este pedido foi concluído. Obrigado pela preferência!" />;
    if (final?.status === "cancelado") return <AvisoPedido titulo="Pedido cancelado" mensagem="Este pedido foi cancelado. Entre em contato com a loja se precisar de ajuda." />;
    return <AvisoPedido titulo="Pedido não localizado" mensagem="O link pode estar incorreto ou o histórico já ter sido removido. Isso não significa que o pedido foi cancelado." />;
  }

  const indiceAtual = etapas.findIndex((etapa) => etapa.valor === pedido.status);
  const cancelado = pedido.status === "cancelado";
  const itens = (pedido.itens ?? []) as ItemPedido[];

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
              <Link
                href="/"
                className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 font-black text-black transition hover:bg-yellow-300"
              >
                Fazer outro pedido
              </Link>
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
          </div>
        </section>
        {!cancelado && <PwaRegistro convitePermitido />}
      </div>
    </main>
  );
}
