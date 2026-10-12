export type Papel = "professora" | "aluno";

export interface Aluno {
  id: string; perfil_id: string | null; nome: string; contato: string; email: string | null;
  nascimento: string | null; modalidade: string; dias_semana: number[];
  valor_mensalidade: number; dia_vencimento: number; ativo: boolean;
}
export interface Anamnese {
  aluno_id: string; objetivo: string; restricoes: string; historico: string; observacoes: string; atualizado_em: string;
}
export interface Treino { id: string; aluno_id: string; nome: "A" | "B" | "C"; foco: string; duracao_min: number }
export interface Exercicio {
  id: string; treino_id: string; ordem: number; nome: string; series: number;
  repeticoes: string; carga: string; descanso_s: number;
}
export interface Aula { id: string; nome: string; horario: string; dia_semana: number }
export interface Presenca { aula_id: string; aluno_id: string; data: string; presente: boolean }
export interface Avaliacao {
  id: string; aluno_id: string; data: string; peso: number | null; altura: number | null;
  gordura_pct: number | null; cintura_cm: number | null; outras_medidas: Record<string, number>; observacoes: string;
}
export interface Mensalidade {
  aluno_id: string; competencia: string; vencimento: string; valor: number;
  pago_em: string | null; aviso_enviado_em: string | null;
}
export interface Concluido { id: string; aluno_id: string; treino_id: string; data: string }

export interface Estado {
  alunos: Aluno[]; anamneses: Anamnese[]; treinos: Treino[]; exercicios: Exercicio[];
  aulas: Aula[]; presencas: Presenca[]; avaliacoes: Avaliacao[]; mensalidades: Mensalidade[]; concluidos: Concluido[];
}
export type Tabela = keyof Estado;
