"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar() {
    setCarregando(true);
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="min-h-screen bg-[#111111] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800">

        <h1 className="text-3xl font-bold text-yellow-400 mb-8 text-center">
          Login Administrativo
        </h1>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg p-3 mb-4 outline-none"
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full bg-zinc-800 text-white rounded-lg p-3 mb-4 outline-none"
        />

        {erro && (
          <div className="bg-red-900 text-red-200 rounded-lg p-3 mb-4">
            {erro}
          </div>
        )}

        <button
          onClick={entrar}
          disabled={carregando}
          className="w-full bg-yellow-400 text-black rounded-lg p-3 font-bold"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

      </div>
    </main>
  );
}