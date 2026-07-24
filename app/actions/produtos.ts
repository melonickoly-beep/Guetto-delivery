"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { obterAdministrador } from "@/lib/supabase-server";

type NovoProduto = {
  categoria_id: string;
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  destaque: boolean;
  promocao: boolean;
  imagem: string;
};

export async function cadastrarProduto(produto: NovoProduto) {
  if (!(await obterAdministrador())) throw new Error("Não autorizado.");
  const { error } = await supabaseAdmin.from("produtos").insert({
    categoria_id: produto.categoria_id,
    nome: produto.nome,
    descricao: produto.descricao,
    preco: produto.preco,
    estoque: produto.estoque,
    destaque: produto.destaque,
    promocao: produto.promocao,
    imagem: produto.imagem,
    disponivel: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    sucesso: true,
  };
}

export async function listarProdutos() {
  if (!(await obterAdministrador())) throw new Error("Não autorizado.");
  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select(`
      *,
      categorias(nome)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
