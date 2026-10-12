"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { Campo, Cartao, IcVoltar } from "@/components/ui";
import { DIAS, MODALIDADES, novoId, hoje } from "@/lib/util";
import type { Aluno } from "@/lib/types";

export default function FormAluno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { dados, upsert } = useApp();
  const router = useRouter();
  const existente = dados.alunos.find((a) => a.id === id);
  const [f, setF] = useState<Aluno>(existente ?? {
    id: novoId(), perfil_id: null, nome: "", contato: "", email: "", nascimento: null, modalidade: "Funcional",
    dias_semana: [1, 3, 5], valor_mensalidade: 220, dia_vencimento: 10, ativo: true,
  });
  const [erro, setErro] = useState("");
  if (id !== "novo" && !existente) return <p className="py-10 text-suave">Aluno não encontrado.</p>;

  const alternaDia = (d: number) => setF({ ...f, dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter((x) => x !== d) : [...f.dias_semana, d].sort() });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { setErro("Informe o nome do aluno."); return; }
    if (f.dias_semana.length === 0) { setErro("Escolha ao menos um dia da semana."); return; }
    await upsert("alunos", { ...f, email: f.email?.trim() || null });
    if (!existente) {
      await upsert("anamneses", { aluno_id: f.id, objetivo: "", restricoes: "", historico: "", observacoes: "", atualizado_em: hoje() });
      for (const [i, letra] of (["A", "B", "C"] as const).entries())
        await upsert("treinos", { id: novoId(), aluno_id: f.id, nome: letra, foco: "", duracao_min: 50 + i * 0 });
    }
    router.push("/alunos");
  }
  return (
    <form onSubmit={salvar} className="flex flex-col gap-4 pt-4">
      <Link href="/alunos" className="inline-flex min-h-[44px] items-center gap-1 text-[16px] font-medium text-link"><IcVoltar width={20} height={20} />Alunos</Link>
      <h1 className="titulo">{existente ? "Editar aluno" : "Novo aluno"}</h1>
      <Cartao className="flex flex-col gap-4">
        <Campo id="nome" rotulo="Nome"><input id="nome" className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="off" /></Campo>
        <Campo id="contato" rotulo="Contato (WhatsApp)"><input id="contato" type="tel" className="campo" value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} placeholder="11 98888-0000" /></Campo>
        <Campo id="email" rotulo="E-mail (para o aluno acessar o app)"><input id="email" type="email" className="campo" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></Campo>
        <Campo id="nasc" rotulo="Data de nascimento"><input id="nasc" type="date" className="campo" value={f.nascimento ?? ""} onChange={(e) => setF({ ...f, nascimento: e.target.value || null })} /></Campo>
        <Campo id="mod" rotulo="Modalidade">
          <select id="mod" className="campo" value={f.modalidade} onChange={(e) => setF({ ...f, modalidade: e.target.value })}>
            {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <fieldset>
          <legend className="rotulo mb-1.5">Dias da semana</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d, i) => (
              <button type="button" key={d} aria-pressed={f.dias_semana.includes(i)} onClick={() => alternaDia(i)}
                className={`min-h-[44px] min-w-[52px] rounded-full px-3 text-[15px] font-semibold ${f.dias_semana.includes(i) ? "bg-azul text-white" : "bg-campo text-tinta"}`}>{d}</button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="valor" rotulo="Mensalidade (R$)"><input id="valor" type="number" min={0} step="0.01" inputMode="decimal" className="campo" value={f.valor_mensalidade} onChange={(e) => setF({ ...f, valor_mensalidade: Number(e.target.value) })} /></Campo>
          <Campo id="venc" rotulo="Dia do vencimento"><input id="venc" type="number" min={1} max={28} inputMode="numeric" className="campo" value={f.dia_vencimento} onChange={(e) => setF({ ...f, dia_vencimento: Math.min(28, Math.max(1, Number(e.target.value))) })} /></Campo>
        </div>
        {existente && (
          <label className="flex min-h-[44px] items-center gap-3 text-[16px]">
            <input type="checkbox" className="h-6 w-6" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />Aluno ativo
          </label>
        )}
      </Cartao>
      {erro && <p role="alert" className="text-[15px] text-perigo">{erro}</p>}
      <button className="btn-azul w-full">Salvar aluno</button>
    </form>
  );
}
