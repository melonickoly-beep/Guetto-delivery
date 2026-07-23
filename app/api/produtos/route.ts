import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("produtos")
    .insert([
      {
        categoria_id: body.categoria_id,
        nome: body.nome,
        descricao: body.descricao,
        preco: body.preco,
        imagem: body.imagem,
        estoque: body.estoque,
        destaque: body.destaque,
        promocao: body.promocao,
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