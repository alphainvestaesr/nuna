"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Estado, Tabela, Papel, Aluno, Mensalidade } from "./types";
import { supabase, supabaseConfigurado } from "./supabase";
import { seedDemo } from "./seed";
import { competenciaAtual, iso, novoId } from "./util";

const TABELAS: Record<Tabela, { nome: string; chave: string[] }> = {
  alunos: { nome: "alunos", chave: ["id"] },
  anamneses: { nome: "anamneses", chave: ["aluno_id"] },
  treinos: { nome: "treinos", chave: ["id"] },
  exercicios: { nome: "exercicios_treino", chave: ["id"] },
  aulas: { nome: "aulas", chave: ["id"] },
  presencas: { nome: "presencas", chave: ["aula_id", "aluno_id", "data"] },
  avaliacoes: { nome: "avaliacoes", chave: ["id"] },
  mensalidades: { nome: "mensalidades", chave: ["aluno_id", "competencia"] },
  concluidos: { nome: "treinos_concluidos", chave: ["id"] },
};
const VAZIO: Estado = { alunos: [], anamneses: [], treinos: [], exercicios: [], aulas: [], presencas: [], avaliacoes: [], mensalidades: [], concluidos: [] };
const CHAVE_DEMO = "alunos-ana-demo-v1";
const CHAVE_SESSAO = "alunos-ana-sessao-v1";

interface Sessao { papel: Papel; nome: string; alunoId: string | null }
interface Ctx {
  pronto: boolean; demo: boolean; sessao: Sessao | null; dados: Estado; erro: string | null;
  upsert: <T extends Tabela>(t: T, linha: Estado[T][number]) => Promise<void>;
  remover: (t: Tabela, linha: Record<string, unknown>) => Promise<void>;
  entrarDemo: (papel: Papel) => void;
  entrar: (email: string, senha: string) => Promise<string | null>;
  cadastrar: (email: string, senha: string, nome: string) => Promise<string | null>;
  sair: () => Promise<void>;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error("useApp fora do provider"); return c };

const mesmaLinha = (chave: string[], a: Record<string, unknown>, b: Record<string, unknown>) => chave.every((k) => a[k] === b[k]);

export function AppProvider({ children }: { children: ReactNode }) {
  const demo = !supabaseConfigurado;
  const [pronto, setPronto] = useState(false);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [dados, setDados] = useState<Estado>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<Sessao | null> => {
    const sb = supabase(); if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data: perfil } = await sb.from("perfis").select("papel,nome").eq("id", user.id).maybeSingle();
    const novo: Estado = { ...VAZIO };
    await Promise.all((Object.keys(TABELAS) as Tabela[]).map(async (t) => {
      const { data, error } = await sb.from(TABELAS[t].nome).select("*");
      if (error) setErro(error.message); else (novo as unknown as Record<string, unknown[]>)[t] = data ?? [];
    }));
    novo.exercicios.sort((a, b) => a.ordem - b.ordem);
    const meu = novo.alunos.find((a) => a.perfil_id === user.id);
    setDados(novo);
    return { papel: (perfil?.papel as Papel) ?? "aluno", nome: perfil?.nome ?? user.email ?? "", alunoId: meu?.id ?? null };
  }, []);

  useEffect(() => {
    (async () => {
      if (demo) {
        try {
          const bruto = localStorage.getItem(CHAVE_DEMO);
          setDados(bruto ? (JSON.parse(bruto) as Estado) : seedDemo());
          const s = localStorage.getItem(CHAVE_SESSAO);
          if (s) setSessao(JSON.parse(s));
        } catch { setDados(seedDemo()); }
      } else {
        setSessao(await carregar());
      }
      setPronto(true);
    })();
  }, [demo, carregar]);

  // Persistência local só no modo demonstração.
  useEffect(() => {
    if (!demo || !pronto) return;
    try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(dados)); } catch { /* sem armazenamento */ }
  }, [dados, demo, pronto]);

  const upsert: Ctx["upsert"] = useCallback(async (t, linha) => {
    const { chave, nome } = TABELAS[t];
    setDados((d) => {
      const lista = d[t] as unknown as Record<string, unknown>[];
      const alvo = linha as unknown as Record<string, unknown>;
      const i = lista.findIndex((x) => mesmaLinha(chave, x, alvo));
      const nova = i >= 0 ? lista.map((x, j) => (j === i ? alvo : x)) : [...lista, alvo];
      return { ...d, [t]: nova };
    });
    const sb = supabase();
    if (sb) {
      const { error } = await sb.from(nome).upsert(linha as never, { onConflict: chave.join(",") });
      if (error) setErro(error.message);
    }
  }, []);

  const remover: Ctx["remover"] = useCallback(async (t, linha) => {
    const { chave, nome } = TABELAS[t];
    setDados((d) => ({ ...d, [t]: (d[t] as unknown as Record<string, unknown>[]).filter((x) => !mesmaLinha(chave, x, linha)) }));
    const sb = supabase();
    if (sb) {
      let q = sb.from(nome).delete();
      chave.forEach((k) => { q = q.eq(k, linha[k] as never); });
      const { error } = await q;
      if (error) setErro(error.message);
    }
  }, []);

  // A professora recebe a cobrança do mês criada automaticamente para cada aluno ativo.
  useEffect(() => {
    if (!pronto || sessao?.papel !== "professora") return;
    const comp = competenciaAtual();
    const faltam = dados.alunos.filter((a) => a.ativo && !dados.mensalidades.some((m) => m.aluno_id === a.id && m.competencia === comp));
    faltam.forEach((a: Aluno) => {
      const m: Mensalidade = {
        aluno_id: a.id, competencia: comp, vencimento: iso(new Date(new Date().getFullYear(), new Date().getMonth(), a.dia_vencimento)),
        valor: a.valor_mensalidade, pago_em: null, aviso_enviado_em: null,
      };
      void upsert("mensalidades", m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, sessao, dados.alunos.length]);

  const entrarDemo = (papel: Papel) => {
    const s: Sessao = papel === "professora"
      ? { papel, nome: "Ana", alunoId: null }
      : { papel, nome: "Marcos", alunoId: dados.alunos[0]?.id ?? null };
    setSessao(s);
    try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch { /* ok */ }
  };
  const entrar = async (email: string, senha: string) => {
    const sb = supabase(); if (!sb) return "Supabase não configurado.";
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) return error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message;
    setSessao(await carregar());
    return null;
  };
  const cadastrar = async (email: string, senha: string, nome: string) => {
    const sb = supabase(); if (!sb) return "Supabase não configurado.";
    const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome } } });
    if (error) return error.message;
    setSessao(await carregar());
    return null;
  };
  const sair = async () => {
    await supabase()?.auth.signOut();
    try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* ok */ }
    setSessao(null);
  };

  const valor = useMemo<Ctx>(() => ({ pronto, demo, sessao, dados, erro, upsert, remover, entrarDemo, entrar, cadastrar, sair }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pronto, demo, sessao, dados, erro, upsert, remover]);
  return <AppCtx.Provider value={valor}>{children}</AppCtx.Provider>;
}
export { novoId };
