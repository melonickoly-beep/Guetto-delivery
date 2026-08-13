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

  if ("categoria_id" in entrada) {
    if (typeof entrada.categoria_id !== "string" || !entrada.categoria_id.trim()) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
    }
    alteracoes.categoria_id = entrada.categoria_id.trim();
  }

  if ("nome" in entrada) {
    if (typeof entrada.nome !== "string" || !entrada.nome.trim()) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }
    alteracoes.nome = entrada.nome.trim();
  }

  if ("destaque" in entrada) {
    if (typeof entrada.destaque !== "boolean") {
      return NextResponse.json({ error: "Destaque inválido." }, { status: 400 });
    }
    alteracoes.destaque = entrada.destaque;
  }

  if ("tipo_venda" in entrada) {
    if (entrada.tipo_venda !== "caixa" && entrada.tipo_venda !== "avulso") {
      return NextResponse.json({ error: "Tipo de venda inválido." }, { status: 400 });
    }
    alteracoes.tipo_venda = entrada.tipo_venda;
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

  if ("estoque" in alteracoes) {
    const { data: produtoAtual, error: erroProdutoAtual } = await supabaseAdmin
      .from("produtos")
      .select("id,grupo_estoque,unidades_por_venda,estoque_unidades")
      .eq("id", id)
      .maybeSingle();

    if (erroProdutoAtual) {
      return NextResponse.json(
        { error: erroProdutoAtual.message },
        { status: 500 }
      );
    }

    if (!produtoAtual) {
      return NextResponse.json(
        { error: "Produto não encontrado." },
        { status: 404 }
      );
    }

    if (
      produtoAtual.grupo_estoque &&
      typeof produtoAtual.estoque_unidades === "number"
    ) {
      const unidadesPorVenda = Math.max(
        1,
        produtoAtual.unidades_por_venda ?? 1
      );
      const unidadesSoltas =
        produtoAtual.estoque_unidades % unidadesPorVenda;
      const estoqueTotalUnidades =
        Number(alteracoes.estoque) * unidadesPorVenda + unidadesSoltas;
      const { data: produtosDoGrupo, error: erroGrupo } = await supabaseAdmin
        .from("produtos")
        .select("id,unidades_por_venda")
        .eq("grupo_estoque", produtoAtual.grupo_estoque);

      if (erroGrupo || !produtosDoGrupo?.length) {
        return NextResponse.json(
          { error: erroGrupo?.message ?? "Grupo de estoque não encontrado." },
          { status: 500 }
        );
      }

      const fatoresDoGrupo = Array.from(
        new Set(
          produtosDoGrupo.map((produto) =>
            Math.max(1, produto.unidades_por_venda ?? 1)
          )
        )
      );

      for (const fator of fatoresDoGrupo) {
        const { error: erroEstoqueDerivado } = await supabaseAdmin
          .from("produtos")
          .update({ estoque: Math.floor(estoqueTotalUnidades / fator) })
          .eq("grupo_estoque", produtoAtual.grupo_estoque)
          .eq("unidades_por_venda", fator);

        if (erroEstoqueDerivado) {
          return NextResponse.json(
            { error: erroEstoqueDerivado.message },
            { status: 500 }
          );
        }
      }

      const { error: erroEstoqueCompartilhado } = await supabaseAdmin
        .from("produtos")
        .update({ estoque_unidades: estoqueTotalUnidades })
        .eq("grupo_estoque", produtoAtual.grupo_estoque);

      if (erroEstoqueCompartilhado) {
        return NextResponse.json(
          { error: erroEstoqueCompartilhado.message },
          { status: 500 }
        );
      }

      const outrasAlteracoes = { ...alteracoes };
      delete outrasAlteracoes.estoque;
      if (Object.keys(outrasAlteracoes).length > 0) {
        const { error: erroOutrasAlteracoes } = await supabaseAdmin
          .from("produtos")
          .update(outrasAlteracoes)
          .eq("id", id);

        if (erroOutrasAlteracoes) {
          return NextResponse.json(
            { error: erroOutrasAlteracoes.message },
            { status: 500 }
          );
        }
      }

      const { data: produtosAtualizados, error: erroProdutosAtualizados } =
        await supabaseAdmin
          .from("produtos")
          .select("*")
          .eq("grupo_estoque", produtoAtual.grupo_estoque)
          .order("nome");

      if (erroProdutosAtualizados || !produtosAtualizados?.length) {
        return NextResponse.json(
          {
            error:
              erroProdutosAtualizados?.message ??
              "Não foi possível confirmar o estoque atualizado.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        produto:
          produtosAtualizados.find((produto) => produto.id === id) ??
          produtosAtualizados[0],
        produtos_relacionados: produtosAtualizados,
      });
    }
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

  return NextResponse.json({ produto: data, produtos_relacionados: [data] });
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
