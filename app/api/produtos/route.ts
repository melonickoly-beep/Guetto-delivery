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
