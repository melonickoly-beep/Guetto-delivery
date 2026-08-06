import { NextResponse } from "next/server";
import { obterAdministrador } from "@/lib/supabase-server";
import {
  excluirResumoDoDia,
  listarResumoDoDia,
} from "@/lib/resumo-sorteio";

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const data = new URL(request.url).searchParams.get("data") ?? hojeEmSaoPaulo();
  if (!DATA_VALIDA.test(data)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  try {
    const participantes = await listarResumoDoDia(data);
    return NextResponse.json({ data, participantes });
  } catch (error) {
    console.error("Erro ao carregar resumo do sorteio:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o resumo do sorteio." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await obterAdministrador())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const data = new URL(request.url).searchParams.get("data") ?? "";
  if (!DATA_VALIDA.test(data)) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  try {
    await excluirResumoDoDia(data);
    return NextResponse.json({ sucesso: true });
  } catch (error) {
    console.error("Erro ao excluir resumo do sorteio:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir o resumo deste dia." },
      { status: 500 }
    );
  }
}
