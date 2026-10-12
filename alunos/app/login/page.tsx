"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Cartao, Campo } from "@/components/ui";

export default function Login() {
  const { pronto, demo, sessao, entrar, cadastrar, entrarDemo } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState(""); const [nome, setNome] = useState("");
  const [novo, setNovo] = useState(false); const [erro, setErro] = useState<string | null>(null); const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (pronto && sessao) router.replace("/"); }, [pronto, sessao, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setCarregando(true);
    const r = novo ? await cadastrar(email, senha, nome) : await entrar(email, senha);
    setCarregando(false); if (r) setErro(r);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="rotulo">Acompanhamento de alunos</p>
        <h1 className="titulo mt-1">Entrar</h1>
      </div>
      {demo ? (
        <Cartao className="flex flex-col gap-3">
          <p className="text-[15px] text-suave">Modo demonstração: os dados de exemplo ficam só neste navegador. Para usar de verdade, preencha as variáveis do Supabase.</p>
          <button className="btn-azul w-full" onClick={() => entrarDemo("professora")}>Entrar como professora</button>
          <button className="btn-cinza w-full" onClick={() => entrarDemo("aluno")}>Entrar como aluno</button>
        </Cartao>
      ) : (
        <Cartao>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            {novo && <Campo id="nome" rotulo="Nome"><input id="nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" /></Campo>}
            <Campo id="email" rotulo="E-mail"><input id="email" type="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Campo>
            <Campo id="senha" rotulo="Senha"><input id="senha" type="password" minLength={6} className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete={novo ? "new-password" : "current-password"} /></Campo>
            {erro && <p role="alert" className="text-[14px] text-perigo">{erro}</p>}
            <button className="btn-azul w-full" disabled={carregando}>{carregando ? "Aguarde…" : novo ? "Criar conta" : "Entrar"}</button>
            <button type="button" className="text-[15px] font-medium text-link" onClick={() => setNovo(!novo)}>
              {novo ? "Já tenho conta" : "Sou aluno e ainda não tenho conta"}
            </button>
          </form>
        </Cartao>
      )}
    </main>
  );
}
