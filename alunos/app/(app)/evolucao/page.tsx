"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Campo, Cartao, Segmentado } from "@/components/ui";
import Grafico from "@/components/Grafico";
import { presencaPct } from "@/lib/regras";
import { hoje, nomeLimpo, novoId } from "@/lib/util";
import type { Avaliacao } from "@/lib/types";

type Aba = "peso" | "gordura" | "medidas";

export default function Evolucao() {
  const { sessao, dados, upsert } = useApp();
  const prof = sessao?.papel === "professora";
  const ativos = dados.alunos.filter((a) => a.ativo);
  const [sel, setSel] = useState(ativos[0]?.id ?? "");
  const [aba, setAba] = useState<Aba>("peso");
  const [form, setForm] = useState(false);
  const alunoId = prof ? sel : sessao?.alunoId ?? "";
  const aluno = dados.alunos.find((a) => a.id === alunoId);
  if (!aluno) return <p className="py-10 text-suave">Nenhum aluno vinculado a este login.</p>;

  const todas = dados.avaliacoes.filter((a) => a.aluno_id === alunoId).sort((a, b) => a.data.localeCompare(b.data));
  const seis = new Date(); seis.setMonth(seis.getMonth() - 6);
  const lista = todas.filter((a) => a.data >= seis.toISOString().slice(0, 10));
  const serie = (k: "peso" | "gordura_pct" | "cintura_cm") => lista.filter((a) => a[k] != null).map((a) => ({ data: a.data, valor: a[k] as number }));
  const cfg = { peso: { k: "peso" as const, un: "kg", rot: "Peso" }, gordura: { k: "gordura_pct" as const, un: "%", rot: "Gordura" }, medidas: { k: "cintura_cm" as const, un: "cm", rot: "Cintura" } }[aba];
  const pontos = serie(cfg.k);
  const atual = pontos[pontos.length - 1]?.valor, inicio = pontos[0]?.valor;
  const delta = atual != null && inicio != null ? +(atual - inicio).toFixed(1) : null;
  const gAtual = serie("gordura_pct").slice(-1)[0]?.valor, cAtual = serie("cintura_cm").slice(-1)[0]?.valor;
  const pres = presencaPct(dados, alunoId);
  const ultima = lista[lista.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-6">
        <p className="rotulo">{nomeLimpo(aluno.nome)} · últimos 6 meses</p>
        <h1 className="titulo mt-1">Evolução</h1>
      </header>
      {prof && (
        <Campo id="aluno" rotulo="Aluno">
          <select id="aluno" className="campo" value={sel} onChange={(e) => { setSel(e.target.value); setForm(false); }}>
            {ativos.map((a) => <option key={a.id} value={a.id}>{nomeLimpo(a.nome)}</option>)}
          </select>
        </Campo>
      )}
      <Segmentado rotulo="Indicador" valor={aba} onChange={setAba} opcoes={[{ id: "peso", nome: "Peso" }, { id: "gordura", nome: "Gordura" }, { id: "medidas", nome: "Medidas" }]} />

      <Cartao>
        <p className="rotulo">{cfg.rot} atual</p>
        <p className="mt-1 text-[44px] font-bold leading-none tracking-[-0.02em]">{atual ?? "—"}<span className="ml-1 text-[20px] font-semibold text-suave">{atual != null ? cfg.un : ""}</span></p>
        {delta !== null && (
          <p className={`mt-2 text-[15px] font-semibold ${delta <= 0 ? "text-ok" : "text-aviso"}`}>
            {delta > 0 ? "+" : ""}{delta} {cfg.un} em {pontos.length} medições
          </p>
        )}
        <div className="mt-4"><Grafico pontos={pontos} unidade={cfg.un} rotulo={cfg.rot} /></div>
        {aba === "medidas" && ultima && Object.keys(ultima.outras_medidas).length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-campo pt-4">
            {Object.entries(ultima.outras_medidas).map(([k, v]) => (
              <div key={k}><dt className="rotulo capitalize">{k}</dt><dd className="text-[19px] font-semibold">{v} cm</dd></div>
            ))}
          </dl>
        )}
      </Cartao>

      <div className="grid grid-cols-3 gap-3">
        {[["Gordura", gAtual != null ? `${gAtual}%` : "—"], ["Cintura", cAtual != null ? `${cAtual} cm` : "—"], ["Presença", pres != null ? `${pres}%` : "—"]].map(([r, v]) => (
          <Cartao key={r} className="!p-4"><p className="rotulo">{r}</p><p className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{v}</p></Cartao>
        ))}
      </div>

      {prof && (form
        ? <NovaAvaliacao alunoId={alunoId} base={ultima} fechar={() => setForm(false)} salvar={(a) => { void upsert("avaliacoes", a); setForm(false); }} />
        : <button className="btn-azul w-full" onClick={() => setForm(true)}>Nova avaliação física</button>)}
    </div>
  );
}

function NovaAvaliacao({ alunoId, base, salvar, fechar }: { alunoId: string; base?: Avaliacao; salvar: (a: Avaliacao) => void; fechar: () => void }) {
  const [v, setV] = useState({ data: hoje(), peso: String(base?.peso ?? ""), altura: String(base?.altura ?? ""), gordura: String(base?.gordura_pct ?? ""), cintura: String(base?.cintura_cm ?? ""), quadril: String(base?.outras_medidas?.quadril ?? ""), braco: String(base?.outras_medidas?.braco ?? ""), obs: "" });
  const n = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const campos: [keyof typeof v, string][] = [["peso", "Peso (kg)"], ["altura", "Altura (m)"], ["gordura", "Gordura (%)"], ["cintura", "Cintura (cm)"], ["quadril", "Quadril (cm)"], ["braco", "Braço (cm)"]];
  return (
    <Cartao>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        const outras: Record<string, number> = {};
        if (n(v.quadril) != null) outras.quadril = n(v.quadril)!;
        if (n(v.braco) != null) outras.braco = n(v.braco)!;
        salvar({ id: novoId(), aluno_id: alunoId, data: v.data, peso: n(v.peso), altura: n(v.altura), gordura_pct: n(v.gordura), cintura_cm: n(v.cintura), outras_medidas: outras, observacoes: v.obs });
      }}>
        <h2 className="text-[22px] font-bold tracking-[-0.02em]">Nova avaliação física</h2>
        <Campo id="av-data" rotulo="Data"><input id="av-data" type="date" className="campo" value={v.data} onChange={set("data")} required /></Campo>
        <div className="grid grid-cols-2 gap-3">
          {campos.map(([k, r]) => <Campo key={k} id={`av-${k}`} rotulo={r}><input id={`av-${k}`} inputMode="decimal" className="campo" value={v[k]} onChange={set(k)} /></Campo>)}
        </div>
        <Campo id="av-obs" rotulo="Observações"><textarea id="av-obs" rows={2} className="campo" value={v.obs} onChange={set("obs")} /></Campo>
        <div className="flex gap-3"><button className="btn-azul flex-1">Salvar avaliação</button><button type="button" className="btn-cinza" onClick={fechar}>Cancelar</button></div>
      </form>
    </Cartao>
  );
}
