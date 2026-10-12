"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { Campo, Cartao, IcCheck, IcMais, Segmentado } from "@/components/ui";
import { hoje, nomeLimpo, novoId } from "@/lib/util";
import type { Exercicio, Treino } from "@/lib/types";

export default function Treinos() {
  return <Suspense fallback={<p className="p-8 text-center text-suave">Carregando…</p>}><Ficha /></Suspense>;
}

function Ficha() {
  const { sessao, dados, upsert, remover } = useApp();
  const prof = sessao?.papel === "professora";
  const params = useSearchParams();
  const ativos = dados.alunos.filter((a) => a.ativo);
  const [alunoSel, setAlunoSel] = useState(params.get("aluno") ?? ativos[0]?.id ?? "");
  const alunoId = prof ? alunoSel : sessao?.alunoId ?? "";
  const aluno = dados.alunos.find((a) => a.id === alunoId);
  const [letra, setLetra] = useState<"A" | "B" | "C">("A");
  const [editando, setEditando] = useState(false);

  if (!aluno) return <p className="py-10 text-suave">Nenhum aluno vinculado a este login.</p>;
  const treino = dados.treinos.find((t) => t.aluno_id === alunoId && t.nome === letra);
  const exercicios = treino ? dados.exercicios.filter((e) => e.treino_id === treino.id).sort((a, b) => a.ordem - b.ordem) : [];
  const concluido = treino ? dados.concluidos.find((c) => c.treino_id === treino.id && c.data === hoje()) : undefined;

  const concluir = () => {
    if (!treino) return;
    if (concluido) void remover("concluidos", concluido as unknown as Record<string, unknown>);
    else void upsert("concluidos", { id: novoId(), aluno_id: alunoId, treino_id: treino.id, data: hoje() });
  };
  const criarTreino = () => upsert("treinos", { id: novoId(), aluno_id: alunoId, nome: letra, foco: "", duracao_min: 50 });
  const novoEx = () => treino && upsert("exercicios", { id: novoId(), treino_id: treino.id, ordem: exercicios.length + 1, nome: "Novo exercício", series: 3, repeticoes: "12", carga: "", descanso_s: 60 });

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-6">
        <p className="rotulo">{nomeLimpo(aluno.nome)} · {aluno.modalidade}</p>
        <h1 className="titulo mt-1">Ficha de treino</h1>
      </header>

      {prof && (
        <Campo id="aluno" rotulo="Aluno">
          <select id="aluno" className="campo" value={alunoSel} onChange={(e) => { setAlunoSel(e.target.value); setEditando(false); }}>
            {ativos.map((a) => <option key={a.id} value={a.id}>{nomeLimpo(a.nome)}</option>)}
          </select>
        </Campo>
      )}

      <Segmentado rotulo="Treino" valor={letra} onChange={(v) => { setLetra(v); setEditando(false); }}
        opcoes={[{ id: "A", nome: "Treino A" }, { id: "B", nome: "Treino B" }, { id: "C", nome: "Treino C" }]} />

      {!treino ? (
        <Cartao>
          <p className="text-suave">Este treino ainda não existe.</p>
          {prof && <button className="btn-azul mt-3" onClick={criarTreino}>Criar Treino {letra}</button>}
        </Cartao>
      ) : (
        <>
          <Cartao escuro>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1a6]">Foco do dia</p>
            {editando ? (
              <div className="mt-2 flex flex-col gap-2">
                <label htmlFor="foco" className="sr-only">Foco do treino</label>
                <input id="foco" className="campo !bg-white/10 !text-tela" value={treino.foco} placeholder="Ex.: Inferiores e core" onChange={(e) => upsert("treinos", { ...treino, foco: e.target.value })} />
                <label htmlFor="dur" className="text-[14px] text-[#a1a1a6]">Duração (min)</label>
                <input id="dur" type="number" inputMode="numeric" className="campo !bg-white/10 !text-tela" value={treino.duracao_min} onChange={(e) => upsert("treinos", { ...treino, duracao_min: Number(e.target.value) } as Treino)} />
              </div>
            ) : (
              <>
                <h2 className="mt-1 text-[26px] font-bold tracking-[-0.02em]">{treino.foco || "Sem foco definido"}</h2>
                <p className="mt-1 text-[16px] text-[#a1a1a6]">{exercicios.length} exercícios · {treino.duracao_min} min</p>
              </>
            )}
          </Cartao>

          <Cartao className="!p-2">
            {exercicios.length === 0 && <p className="p-3 text-suave">Nenhum exercício nesta ficha.</p>}
            <ol>
              {exercicios.map((e, i) => (editando ? (
                <LinhaEdicao key={e.id} e={e} n={i + 1} salvar={(x) => upsert("exercicios", x)} apagar={() => remover("exercicios", e as unknown as Record<string, unknown>)} />
              ) : (
                <li key={e.id} className="flex items-center gap-3 border-b border-campo p-3 last:border-0">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-campo text-[14px] font-semibold text-suave">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold">{e.nome}</p>
                    <p className="text-[14px] text-suave">Descanso {e.descanso_s}s{e.carga ? ` · ${e.carga}` : ""}</p>
                  </div>
                  <p className="whitespace-nowrap text-[17px] font-semibold">{e.series} × {e.repeticoes}</p>
                </li>
              )))}
            </ol>
            {editando && <button onClick={novoEx} className="btn-cinza m-2 gap-1"><IcMais width={18} height={18} />Adicionar exercício</button>}
          </Cartao>

          <div className="flex gap-3">
            {!prof && (
              <button onClick={concluir} aria-pressed={!!concluido} className={`${concluido ? "btn bg-ok-fundo text-ok" : "btn-azul"} flex-1 gap-2`}>
                {concluido && <IcCheck width={20} height={20} />}{concluido ? "Treino concluído" : "Concluir treino"}
              </button>
            )}
            {prof && <button onClick={() => setEditando(!editando)} className={`${editando ? "btn-azul" : "btn-cinza"} flex-1`}>{editando ? "Concluir edição" : "Editar"}</button>}
          </div>
        </>
      )}
    </div>
  );
}

function LinhaEdicao({ e, n, salvar, apagar }: { e: Exercicio; n: number; salvar: (e: Exercicio) => void; apagar: () => void }) {
  const set = (p: Partial<Exercicio>) => salvar({ ...e, ...p });
  return (
    <li className="flex flex-col gap-2 border-b border-campo p-3 last:border-0">
      <label htmlFor={`n-${e.id}`} className="rotulo">Exercício {n}</label>
      <input id={`n-${e.id}`} className="campo" value={e.nome} onChange={(ev) => set({ nome: ev.target.value })} />
      <div className="grid grid-cols-4 gap-2">
        {([["Séries", "series", "number"], ["Reps ou tempo", "repeticoes", "text"], ["Carga", "carga", "text"], ["Desc. (s)", "descanso_s", "number"]] as const).map(([rot, k, tipo]) => (
          <div key={k} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={`${k}-${e.id}`} className="text-[12px] font-semibold text-suave">{rot}</label>
            <input id={`${k}-${e.id}`} type={tipo} inputMode={tipo === "number" ? "numeric" : "text"} className="campo !px-2 !py-2 text-center"
              value={e[k]} onChange={(ev) => set({ [k]: tipo === "number" ? Number(ev.target.value) : ev.target.value } as Partial<Exercicio>)} />
          </div>
        ))}
      </div>
      <button onClick={apagar} className="self-start text-[15px] font-medium text-perigo min-h-[44px]">Remover exercício</button>
    </li>
  );
}
