"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { Avatar, Cartao, Selo } from "@/components/ui";
import { IcCheck } from "@/components/ui";
import { alunosDaAula, linkWhatsApp, mensalidadeAtual, presencaPct, situacao } from "@/lib/regras";
import { brl, dataExtensa, hoje, primeiroNome, nomeLimpo, saudacao } from "@/lib/util";

export default function Inicio() {
  const { sessao } = useApp();
  return sessao?.papel === "professora" ? <InicioProfessora /> : <InicioAluno />;
}

function InicioProfessora() {
  const { sessao, dados, upsert } = useApp();
  const hojeIso = hoje();
  const dow = new Date().getDay();
  const agora = new Date().toTimeString().slice(0, 5);
  const aulasHoje = dados.aulas.filter((a) => a.dia_semana === dow).sort((a, b) => a.horario.localeCompare(b.horario));
  const proxima = aulasHoje.find((a) => a.horario.slice(0, 5) >= agora) ?? aulasHoje[aulasHoje.length - 1];
  const esperados = proxima ? alunosDaAula(dados, proxima.id) : [];

  const presente = (aulaId: string, alunoId: string) => dados.presencas.find((p) => p.aula_id === aulaId && p.aluno_id === alunoId && p.data === hojeIso)?.presente ?? false;
  const alternar = (aulaId: string, alunoId: string) => upsert("presencas", { aula_id: aulaId, aluno_id: alunoId, data: hojeIso, presente: !presente(aulaId, alunoId) });

  const avisos = dados.alunos
    .filter((a) => a.ativo)
    .map((a) => ({ a, m: mensalidadeAtual(dados, a.id) }))
    .filter((x) => x.m && !x.m.pago_em && situacao(x.m).dias <= 7)
    .sort((x, y) => x.m!.vencimento.localeCompare(y.m!.vencimento));

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-6">
        <p className="rotulo">{dataExtensa()}</p>
        <h1 className="titulo mt-1">{saudacao()}, {sessao?.nome}.</h1>
      </header>

      <Cartao escuro>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1a6]">Próxima aula</p>
        {proxima ? (
          <>
            <h2 className="mt-1 text-[26px] font-bold tracking-[-0.02em]">{proxima.nome}, {proxima.horario.slice(0, 5)}</h2>
            <p className="mt-1 text-[16px] text-[#a1a1a6]">{esperados.length} {esperados.length === 1 ? "aluno esperado" : "alunos esperados"}</p>
            <div className="mt-5 flex items-center gap-5">
              <a href="#presenca" className="btn-azul">Fazer chamada</a>
              {esperados[0] && <Link href={`/treinos?aluno=${esperados[0].id}`} className="text-[16px] font-medium text-[#2997ff]">Ver ficha ›</Link>}
            </div>
          </>
        ) : <p className="mt-2 text-[17px]">Sem aulas cadastradas para hoje.</p>}
      </Cartao>

      <section id="presenca" aria-labelledby="h-pres" className="scroll-mt-4">
        <h2 id="h-pres" className="mb-2 px-1 text-[22px] font-bold tracking-[-0.02em]">Presença de hoje</h2>
        <Cartao className="!p-2">
          {aulasHoje.flatMap((au) => alunosDaAula(dados, au.id).map((al) => ({ au, al }))).length === 0 && <p className="p-3 text-suave">Nenhum aluno esperado hoje.</p>}
          <ul>
            {aulasHoje.flatMap((au) => alunosDaAula(dados, au.id).map((al) => ({ au, al }))).map(({ au, al }) => {
              const ok = presente(au.id, al.id);
              return (
                <li key={au.id + al.id} className="flex items-center gap-3 border-b border-campo p-3 last:border-0">
                  <Avatar nome={al.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold">{nomeLimpo(al.nome)}</p>
                    <p className="text-[14px] text-suave">{au.horario.slice(0, 5)} · {au.nome}</p>
                  </div>
                  <button onClick={() => alternar(au.id, al.id)} aria-pressed={ok}
                    aria-label={`${ok ? "Desmarcar" : "Marcar"} presença de ${primeiroNome(al.nome)}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${ok ? "border-ok bg-ok text-white" : "border-[#c7c7cc] text-transparent"}`}>
                    <IcCheck />
                  </button>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </section>

      <section aria-labelledby="h-men">
        <h2 id="h-men" className="px-1 text-[22px] font-bold tracking-[-0.02em]">Mensalidades</h2>
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-aviso">Vencem esta semana</p>
        <Cartao className="!p-2">
          {avisos.length === 0 && <p className="p-3 text-suave">Nenhuma mensalidade vencendo nos próximos 7 dias.</p>}
          <ul>
            {avisos.map(({ a, m }) => {
              const s = situacao(m);
              const msg = `Oi, ${primeiroNome(a.nome)}! Passando para lembrar da mensalidade de ${brl(m!.valor)}, com vencimento dia ${Number(m!.vencimento.slice(8))}. Qualquer dúvida, é só chamar!`;
              return (
                <li key={a.id} className="flex items-center gap-3 border-b border-campo p-3 last:border-0">
                  <Avatar nome={a.nome} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold">{nomeLimpo(a.nome)}</p>
                    <p className="text-[14px] text-suave">{s.tipo === "atraso" ? "Atrasada" : s.texto}{m!.aviso_enviado_em ? " · avisada" : ""}</p>
                  </div>
                  <a href={linkWhatsApp(a, msg)} target="_blank" rel="noopener noreferrer"
                    onClick={() => upsert("mensalidades", { ...m!, aviso_enviado_em: new Date().toISOString() })}
                    className="btn-cinza min-h-[44px] !px-4 text-[15px]">Avisar<span className="sr-only"> {primeiroNome(a.nome)} pelo WhatsApp</span></a>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </section>
    </div>
  );
}

function InicioAluno() {
  const { sessao, dados } = useApp();
  const a = dados.alunos.find((x) => x.id === sessao?.alunoId);
  if (!a) return <p className="py-10 text-suave">Seu cadastro de aluno ainda não foi vinculado. Peça à professora para usar o mesmo e-mail do login.</p>;
  const m = mensalidadeAtual(dados, a.id), s = situacao(m);
  const pct = presencaPct(dados, a.id);
  const feitos = dados.concluidos.filter((c) => c.aluno_id === a.id).length;
  return (
    <div className="flex flex-col gap-4">
      <header className="pt-6">
        <p className="rotulo">{dataExtensa()}</p>
        <h1 className="titulo mt-1">{saudacao()}, {primeiroNome(a.nome)}.</h1>
      </header>
      <Cartao escuro>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1a6]">Seu treino</p>
        <h2 className="mt-1 text-[26px] font-bold tracking-[-0.02em]">{feitos} treinos concluídos</h2>
        <Link href="/treinos" className="btn-azul mt-5">Abrir ficha de treino</Link>
      </Cartao>
      <Cartao className="flex items-center justify-between">
        <div><p className="rotulo">Presença (30 dias)</p><p className="mt-1 text-[28px] font-bold">{pct === null ? "—" : pct + "%"}</p></div>
        <div className="text-right"><p className="rotulo">Mensalidade</p><div className="mt-2"><Selo tipo={s.tipo}>{s.texto}</Selo></div></div>
      </Cartao>
    </div>
  );
}
