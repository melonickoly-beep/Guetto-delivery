import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const entrada = body?.alteracoes;

  if (!id || !entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return NextResponse.json(
      { error: "Dados do produto inválidos." },
      { status: 400 }
    );
  }

  const alteracoes: Record<string, unknown> = {};

  if ("preco" in entrada) {
    const preco = Number(entrada.preco);
    if (!Number.isFinite(preco) || preco < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }
    alteracoes.preco = preco;
  }

  if ("estoque" in entrada) {
    const estoque = Number(entrada.estoque);
    if (!Number.isInteger(estoque) || estoque < 0) {
      return NextResponse.json({ error: "Estoque inválido." }, { status: 400 });
    }
    alteracoes.estoque = estoque;
  }

  if ("descricao" in entrada) {
    if (typeof entrada.descricao !== "string") {
      return NextResponse.json({ error: "Descrição inválida." }, { status: 400 });
    }
    alteracoes.descricao = entrada.descricao.trim();
  }

  if ("imagem" in entrada) {
    if (typeof entrada.imagem !== "string") {
      return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    }
    alteracoes.imagem = entrada.imagem;
  }

  if ("estoque_opcoes" in entrada) {
    const estoqueOpcoes = entrada.estoque_opcoes;
    const opcoesValidas =
      estoqueOpcoes !== null &&
      typeof estoqueOpcoes === "object" &&
      !Array.isArray(estoqueOpcoes) &&
      Object.entries(estoqueOpcoes).every(
        ([opcao, quantidade]) =>
          Boolean(opcao.trim()) &&
          Number.isInteger(Number(quantidade)) &&
          Number(quantidade) >= 0
      );

    if (!opcoesValidas) {
      return NextResponse.json(
        { error: "Estoque das opções inválido." },
        { status: 400 }
      );
    }
    alteracoes.estoque_opcoes = estoqueOpcoes;
  }

  if (Object.keys(alteracoes).length === 0) {
    return NextResponse.json(
      { error: "Nenhuma alteração informada." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("produtos")
    .update(alteracoes)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Produto não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const preco = Number(body.preco);
  const estoque = Number(body.estoque);

  if (
    !body.categoria_id ||
    typeof body.nome !== "string" ||
    !body.nome.trim() ||
    !Number.isFinite(preco) ||
    preco < 0 ||
    !Number.isInteger(estoque) ||
    estoque < 0
  ) {
    return NextResponse.json({ error: "Dados do produto inválidos." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("produtos")
    .insert([
      {
        categoria_id: body.categoria_id,
        nome: body.nome.trim(),
        descricao: typeof body.descricao === "string" ? body.descricao.trim() : "",
        preco,
        imagem: typeof body.imagem === "string" ? body.imagem : "",
        estoque,
        destaque: Boolean(body.destaque),
        promocao: Boolean(body.promocao),
        disponivel: true,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
