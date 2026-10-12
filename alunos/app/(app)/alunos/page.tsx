"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Avatar, Cabecalho, Cartao, IcBusca, IcMais, Selo } from "@/components/ui";
import { mensalidadeAtual, situacao } from "@/lib/regras";
import { brl, hoje, nomeLimpo } from "@/lib/util";
import type { Anamnese } from "@/lib/types";

export default function Alunos() {
  const { sessao, dados, upsert } = useApp();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (sessao && sessao.papel !== "professora") router.replace("/"); }, [sessao, router]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return dados.alunos.filter((a) => a.ativo && (!q || a.nome.toLowerCase().includes(q) || a.modalidade.toLowerCase().includes(q)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [dados.alunos, busca]);
  const aluno = dados.alunos.find((a) => a.id === (sel ?? lista[0]?.id));

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho rotulo={`${dados.alunos.filter((a) => a.ativo).length} ativos`} titulo="Alunos"
        acao={<Link href="/alunos/novo" className="btn-azul gap-1 !px-4 text-[15px]"><IcMais width={18} height={18} />Novo aluno</Link>} />

      <div className="relative">
        <IcBusca className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-suave" width={20} height={20} />
        <label htmlFor="busca" className="sr-only">Buscar aluno</label>
        <input id="busca" type="search" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} className="campo !pl-11" />
      </div>

      <Cartao className="!p-2">
        {lista.length === 0 && <p className="p-3 text-suave">Nenhum aluno encontrado.</p>}
        <ul>
          {lista.map((a) => {
            const s = situacao(mensalidadeAtual(dados, a.id));
            const ativo = aluno?.id === a.id;
            return (
              <li key={a.id} className="border-b border-campo last:border-0">
                <button onClick={() => setSel(a.id)} aria-pressed={ativo}
                  className={`flex w-full items-center gap-3 rounded-[16px] p-3 text-left ${ativo ? "bg-tela" : ""}`}>
                  <Avatar nome={a.nome} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">{nomeLimpo(a.nome)}</span>
                    <span className="block text-[14px] text-suave">{a.modalidade} · {a.dias_semana.length}x por semana</span>
                  </span>
                  <Selo tipo={s.tipo}>{s.texto}</Selo>
                </button>
              </li>
            );
          })}
        </ul>
      </Cartao>

      {aluno && <Detalhe key={aluno.id} alunoId={aluno.id} onSalvar={(an) => upsert("anamneses", an)} />}
    </div>
  );
}

function Detalhe({ alunoId, onSalvar }: { alunoId: string; onSalvar: (a: Anamnese) => void }) {
  const { dados, upsert } = useApp();
  const aluno = dados.alunos.find((a) => a.id === alunoId)!;
  const atual = dados.anamneses.find((a) => a.aluno_id === alunoId);
  const [f, setF] = useState<Anamnese>(atual ?? { aluno_id: alunoId, objetivo: "", restricoes: "", historico: "", observacoes: "", atualizado_em: hoje() });
  const [salvo, setSalvo] = useState(false);
  const m = mensalidadeAtual(dados, alunoId);
  const campos: [keyof Anamnese, string][] = [["objetivo", "Objetivo"], ["restricoes", "Restrições e lesões"], ["historico", "Histórico de atividade física"], ["observacoes", "Observações"]];

  return (
    <>
      <Cartao>
        <div className="flex items-center gap-3">
          <Avatar nome={aluno.nome} grande />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-bold tracking-[-0.02em]">{nomeLimpo(aluno.nome)}</h2>
            <p className="text-[15px] text-suave">{aluno.contato}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-tela p-3">
          <div>
            <p className="rotulo">Mensalidade</p>
            <p className="text-[17px] font-semibold">{brl(aluno.valor_mensalidade)} · dia {aluno.dia_vencimento}</p>
          </div>
          {m && (m.pago_em
            ? <button className="btn-cinza !min-h-[40px] !px-4 text-[15px]" onClick={() => upsert("mensalidades", { ...m, pago_em: null })}>Desfazer pago</button>
            : <button className="btn-azul !min-h-[40px] !px-4 text-[15px]" onClick={() => upsert("mensalidades", { ...m, pago_em: hoje() })}>Marcar como pago</button>)}
        </div>
        <Link href={`/alunos/${alunoId}`} className="mt-3 inline-block text-[16px] font-medium text-link">Editar cadastro ›</Link>
      </Cartao>

      <Cartao>
        <p className="rotulo">Anamnese</p>
        <form className="mt-3 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSalvar({ ...f, atualizado_em: hoje() }); setSalvo(true); setTimeout(() => setSalvo(false), 2000); }}>
          {campos.map(([k, rotulo]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label htmlFor={`an-${k}`} className="text-[15px] font-semibold">{rotulo}</label>
              <textarea id={`an-${k}`} rows={2} className="campo" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button className="btn-azul">Salvar anamnese</button>
            <span role="status" className="text-[15px] text-ok">{salvo ? "Salvo" : ""}</span>
          </div>
        </form>
      </Cartao>
    </>
  );
}
