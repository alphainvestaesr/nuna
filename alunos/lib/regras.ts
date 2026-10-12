import type { Aluno, Estado, Mensalidade } from "./types";
import { competenciaAtual, diasEntre, hoje, addDias, iso } from "./util";

export type Situacao = { tipo: "ok" | "aviso" | "atraso"; texto: string; dias: number };

export function mensalidadeAtual(d: Estado, alunoId: string): Mensalidade | undefined {
  return d.mensalidades.find((m) => m.aluno_id === alunoId && m.competencia === competenciaAtual());
}
export function situacao(m: Mensalidade | undefined): Situacao {
  if (!m) return { tipo: "ok", texto: "Em dia", dias: 99 };
  if (m.pago_em) return { tipo: "ok", texto: "Em dia", dias: 99 };
  const dias = diasEntre(m.vencimento, hoje());
  const dia = Number(m.vencimento.slice(8));
  if (dias < 0) return { tipo: "atraso", texto: "Atrasado", dias };
  return { tipo: "aviso", texto: `Vence dia ${dia}`, dias };
}
/** Percentual de presença nos últimos 30 dias, a partir das chamadas. */
export function presencaPct(d: Estado, alunoId: string): number | null {
  const desde = iso(addDias(new Date(), -30));
  const reg = d.presencas.filter((p) => p.aluno_id === alunoId && p.data >= desde);
  if (!reg.length) return null;
  return Math.round((reg.filter((p) => p.presente).length / reg.length) * 100);
}
export function alunosDaAula(d: Estado, aulaId: string): Aluno[] {
  const aula = d.aulas.find((a) => a.id === aulaId);
  if (!aula) return [];
  return d.alunos.filter((a) => a.ativo && a.modalidade === aula.nome && a.dias_semana.includes(aula.dia_semana));
}
export function linkWhatsApp(a: Aluno, texto: string) {
  const tel = a.contato.replace(/\D/g, "");
  return `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodeURIComponent(texto)}`;
}
