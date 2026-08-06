import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET_RESUMOS = "resumos-sorteio";

export type ItemResumoSorteio = {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  escolhas_combo?: Record<string, string | string[]> | null;
};

export type ParticipanteSorteio = {
  pedido_id: string;
  criado_em: string;
  cliente_nome: string;
  telefone: string;
  itens: ItemResumoSorteio[];
  total: number;
};

function dataEmSaoPaulo(data: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(data));
}

function caminhoResumo(pedidoId: string, criadoEm: string) {
  const data = dataEmSaoPaulo(criadoEm);
  const horarioSeguro = criadoEm.replace(/[:.]/g, "-");
  return `${data}/${horarioSeguro}_${pedidoId}.json`;
}

async function garantirBucketResumos() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET_RESUMOS);
  if (data) return;

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET_RESUMOS, {
    public: false,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["application/json"],
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw error;
  }
}

async function buscarPedidoParaResumo(pedidoId: string) {
  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .select("id,created_at,cliente_nome,telefone,itens,total,status")
    .eq("id", pedidoId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function registrarPedidoNoResumo(pedidoId: string) {
  const pedido = await buscarPedidoParaResumo(pedidoId);
  if (!pedido || pedido.status === "cancelado") return;

  await garantirBucketResumos();
  const participante: ParticipanteSorteio = {
    pedido_id: pedido.id,
    criado_em: pedido.created_at,
    cliente_nome: pedido.cliente_nome,
    telefone: pedido.telefone,
    itens: Array.isArray(pedido.itens)
      ? (pedido.itens as ItemResumoSorteio[])
      : [],
    total: Number(pedido.total),
  };
  const arquivo = Buffer.from(JSON.stringify(participante, null, 2), "utf8");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_RESUMOS)
    .upload(caminhoResumo(pedido.id, pedido.created_at), arquivo, {
      contentType: "application/json",
      upsert: true,
    });

  if (error) throw error;
}

export async function removerPedidoDoResumo(pedidoId: string) {
  const pedido = await buscarPedidoParaResumo(pedidoId);
  if (!pedido) return;

  await garantirBucketResumos();
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_RESUMOS)
    .remove([caminhoResumo(pedido.id, pedido.created_at)]);

  if (error) throw error;
}

export async function listarResumoDoDia(data: string) {
  await garantirBucketResumos();
  const { data: arquivos, error } = await supabaseAdmin.storage
    .from(BUCKET_RESUMOS)
    .list(data, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) throw error;

  const participantes = await Promise.all(
    (arquivos ?? [])
      .filter((arquivo) => arquivo.name.endsWith(".json"))
      .map(async (arquivo) => {
        const { data: conteudo, error: erroDownload } =
          await supabaseAdmin.storage
            .from(BUCKET_RESUMOS)
            .download(`${data}/${arquivo.name}`);
        if (erroDownload) throw erroDownload;
        return JSON.parse(await conteudo.text()) as ParticipanteSorteio;
      })
  );

  return participantes.sort(
    (participanteA, participanteB) =>
      new Date(participanteA.criado_em).getTime() -
      new Date(participanteB.criado_em).getTime()
  );
}

export async function excluirResumoDoDia(data: string) {
  await garantirBucketResumos();
  const { data: arquivos, error } = await supabaseAdmin.storage
    .from(BUCKET_RESUMOS)
    .list(data, { limit: 1000 });

  if (error) throw error;
  const caminhos = (arquivos ?? [])
    .filter((arquivo) => arquivo.name.endsWith(".json"))
    .map((arquivo) => `${data}/${arquivo.name}`);

  if (caminhos.length === 0) return;
  const { error: erroExclusao } = await supabaseAdmin.storage
    .from(BUCKET_RESUMOS)
    .remove(caminhos);
  if (erroExclusao) throw erroExclusao;
}
