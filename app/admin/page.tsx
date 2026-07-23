"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Categoria = {
  id: string;
  nome: string;
  icone: string;
};

type Produto = {
  id: string;
  categoria_id: string;
  nome: string;
  descricao: string;
  preco: number;
  estoque: number;
  imagem: string;
  destaque: boolean;
};

export default function AdminPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [categoriaId, setCategoriaId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [destaque, setDestaque] = useState(false);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarCategorias();
    carregarProdutos();
  }, []);

  async function carregarCategorias() {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("nome");

    if (error) {
      alert(error.message);
      return;
    }

    setCategorias(data ?? []);
  }

  async function carregarProdutos() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome");

    if (error) {
      alert(error.message);
      return;
    }

    setProdutos(data ?? []);
  }

  function selecionarImagem(
    e: ChangeEvent<HTMLInputElement>
  ) {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];

    setArquivo(file);

    setPreview(URL.createObjectURL(file));
  }

  async function uploadImagem() {
    if (!arquivo) return "";

    const extensao = arquivo.name.split(".").pop();

    const nomeArquivo =
      crypto.randomUUID() + "." + extensao;

    const { error } = await supabase.storage
      .from("produtos")
      .upload(nomeArquivo, arquivo);

    if (error) {
      alert(error.message);
      return "";
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("produtos")
      .getPublicUrl(nomeArquivo);

    return publicUrl;
  }
    async function salvarProduto(e: FormEvent) {
    e.preventDefault();

    if (!categoriaId) {
      alert("Selecione uma categoria.");
      return;
    }

    setSalvando(true);

    const imagem = await uploadImagem();

    const { error } = await supabase
      .from("produtos")
      .insert({
        categoria_id: categoriaId,
        nome,
        descricao,
        preco: Number(preco),
        estoque: Number(estoque),
        imagem,
        destaque,
      });

    setSalvando(false);

    if (error) {
      alert(error.message);
      return;
    }

    setCategoriaId("");
    setNome("");
    setDescricao("");
    setPreco("");
    setEstoque("");
    setDestaque(false);
    setArquivo(null);
    setPreview("");

    carregarProdutos();

    alert("Produto cadastrado com sucesso!");
  }

  async function excluirProduto(id: string) {
    if (!confirm("Deseja realmente excluir este produto?")) {
      return;
    }

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    carregarProdutos();
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-8">

        <h1 className="text-4xl font-bold text-yellow-400 mb-8">
          Painel Administrativo
        </h1>

        <form
          onSubmit={salvarProduto}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10"
        >

          <div className="grid md:grid-cols-2 gap-5">

            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            >
              <option value="">
                Escolha uma categoria
              </option>

              {categorias.map((categoria) => (
                <option
                  key={categoria.id}
                  value={categoria.id}
                >
                  {categoria.nome}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Nome do produto"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            <textarea
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3 md:col-span-2 h-28"
            />
                        <input
              type="number"
              step="0.01"
              placeholder="Preço"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            <input
              type="number"
              placeholder="Estoque"
              value={estoque}
              onChange={(e) => setEstoque(e.target.value)}
              className="bg-zinc-800 rounded-lg p-3"
              required
            />

            <div className="md:col-span-2">

              <input
                type="file"
                accept="image/*"
                onChange={selecionarImagem}
              />

            </div>

            {preview && (

              <div className="md:col-span-2">

                <Image
                  src={preview}
                  alt="Preview"
                  width={220}
                  height={220}
                  className="rounded-lg border border-zinc-700 object-cover"
                />

              </div>

            )}

            <label className="md:col-span-2 flex items-center gap-3">

              <input
                type="checkbox"
                checked={destaque}
                onChange={(e) =>
                  setDestaque(e.target.checked)
                }
              />

              <span>Produto em destaque</span>

            </label>

          </div>

          <button
            type="submit"
            disabled={salvando}
            className="mt-8 bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-lg transition"
          >
            {salvando ? "Salvando..." : "Salvar Produto"}
          </button>

        </form>

        <h2 className="text-3xl font-bold mb-6">
          Produtos cadastrados
        </h2>

        <div className="grid gap-4"></div>
                  {produtos.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-zinc-400">
              Nenhum produto cadastrado.
            </div>
          )}

          {produtos.map((produto) => (
            <div
              key={produto.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-5">

                {produto.imagem ? (
                  <Image
                    src={produto.imagem}
                    alt={produto.nome}
                    width={90}
                    height={90}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-[90px] h-[90px] rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">
                    Sem imagem
                  </div>
                )}

                <div>

                  <h3 className="text-xl font-bold">
                    {produto.nome}
                  </h3>

                  <p className="text-zinc-400">
                    {produto.descricao}
                  </p>

                  <p className="mt-2">
                    <span className="font-semibold">
                      Preço:
                    </span>{" "}
                    R$ {produto.preco.toFixed(2)}
                  </p>

                  <p>
                    <span className="font-semibold">
                      Estoque:
                    </span>{" "}
                    {produto.estoque}
                  </p>

                  {produto.destaque && (
                    <span className="inline-block mt-2 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold">
                      Destaque
                    </span>
                  )}

                </div>

              </div>

              <button
                onClick={() => excluirProduto(produto.id)}
                className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Excluir
              </button>

            </div>
          ))}
                  </div>

        <div className="mt-12 bg-zinc-900 border border-zinc-800 rounded-xl p-6">

          <h2 className="text-2xl font-bold mb-4">
            Resumo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Produtos
              </p>

              <p className="text-3xl font-bold">
                {produtos.length}
              </p>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Categorias
              </p>

              <p className="text-3xl font-bold">
                {categorias.length}
              </p>
            </div>

            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-400 text-sm">
                Destaques
              </p>

              <p className="text-3xl font-bold">
                {
                  produtos.filter(
                    (produto) => produto.destaque
                  ).length
                }
              </p>
            </div>

          </div>

        </div>

      </div>

    </main>
  );
}
