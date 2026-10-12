import type { Estado, Aluno, Treino, Exercicio, Aula, Avaliacao } from "./types";
import { addDias, iso, hoje } from "./util";

/** Dados de exemplo (fictícios) usados no modo demonstração. */
export function seedDemo(): Estado {
  const hojeD = new Date();
  const diaVenc = (off: number) => Math.min(28, Math.max(1, addDias(hojeD, off).getDate()));
  const mk = (n: number, nome: string, tel: string, mod: string, dias: number[], valor: number, off: number, nasc: string): Aluno => ({
    id: `a${n}`, perfil_id: null, nome: `${nome} (exemplo)`, contato: tel, email: `${nome.split(" ")[0].toLowerCase()}@exemplo.com`,
    nascimento: nasc, modalidade: mod, dias_semana: dias, valor_mensalidade: valor, dia_vencimento: diaVenc(off), ativo: true,
  });
  const alunos = [
    mk(1, "Marcos Lima", "11 98888-1111", "Funcional", [1, 2, 3, 4, 5], 220, 2, "1990-05-14"),
    mk(2, "Fernanda Costa", "11 97777-2222", "Funcional", [1, 2, 3, 4, 5], 220, -9, "1988-09-02"),
    mk(3, "Camila Rocha", "11 96666-3333", "Pilates", [1, 2, 3, 4, 5], 170, -3, "1995-01-20"),
    mk(4, "Roberto Souza", "11 95555-4444", "Musculação", [1, 2, 3, 4, 5, 6], 190, 4, "1975-11-30"),
    mk(5, "Júlia Martins", "11 94444-5555", "Pilates", [1, 2, 3, 4, 5], 170, 12, "1992-03-08"),
    mk(6, "Paulo Almeida", "11 93333-6666", "Funcional", [1, 2, 3, 4, 5], 220, 6, "1985-07-25"),
  ];
  const foco = ["Inferiores e core", "Costas e bíceps", "Peito, ombros e tríceps"];
  const ex: Array<Array<[string, number, string, string, number]>> = [
    [["Agachamento livre", 4, "10", "30 kg", 60], ["Afundo com halteres", 3, "12", "10 kg", 45], ["Stiff", 3, "12", "20 kg", 60], ["Prancha", 3, "40s", "", 30]],
    [["Puxada frontal", 4, "10", "40 kg", 60], ["Remada curvada", 3, "12", "30 kg", 60], ["Rosca direta", 3, "12", "12 kg", 45], ["Abdominal remador", 3, "15", "", 30]],
    [["Supino reto", 4, "10", "25 kg", 60], ["Desenvolvimento com halteres", 3, "12", "10 kg", 60], ["Tríceps na polia", 3, "12", "20 kg", 45]],
  ];
  const treinos: Treino[] = [];
  const exercicios: Exercicio[] = [];
  alunos.forEach((a) =>
    (["A", "B", "C"] as const).forEach((letra, i) => {
      const t: Treino = { id: `t-${a.id}-${letra}`, aluno_id: a.id, nome: letra, foco: foco[i], duracao_min: 45 + i * 5 };
      treinos.push(t);
      ex[i].forEach(([nome, series, repeticoes, carga, descanso_s], j) =>
        exercicios.push({ id: `e-${t.id}-${j}`, treino_id: t.id, ordem: j + 1, nome, series, repeticoes, carga, descanso_s }));
    }));
  const aulas: Aula[] = [];
  for (let d = 1; d <= 5; d++) {
    aulas.push({ id: `au-f7-${d}`, nome: "Funcional", horario: "07:00", dia_semana: d });
    aulas.push({ id: `au-p9-${d}`, nome: "Pilates", horario: "09:00", dia_semana: d });
    aulas.push({ id: `au-f18-${d}`, nome: "Funcional", horario: "18:30", dia_semana: d });
  }
  aulas.push({ id: "au-m8-6", nome: "Musculação", horario: "08:00", dia_semana: 6 });
  for (let d = 1; d <= 5; d++) aulas.push({ id: `au-m17-${d}`, nome: "Musculação", horario: "17:00", dia_semana: d });

  const avaliacoes: Avaliacao[] = [];
  alunos.forEach((a, k) => {
    for (let n = 5; n >= 0; n--) {
      const d = new Date(hojeD.getFullYear(), hojeD.getMonth() - n, 5);
      const pas = 5 - n;
      avaliacoes.push({
        id: `av-${a.id}-${n}`, aluno_id: a.id, data: iso(d), altura: 1.7 + k * 0.02,
        peso: +(80 - k * 4 - pas * 0.8).toFixed(1), gordura_pct: +(24 - k - pas * 0.6).toFixed(1),
        cintura_cm: +(90 - k * 3 - pas * 1.2).toFixed(1), outras_medidas: { quadril: +(104 - k * 2 - pas * 0.6).toFixed(1), braco: +(32 + pas * 0.3).toFixed(1) },
        observacoes: "",
      });
    }
  });
  // Presenças dos últimos 30 dias para o cálculo de frequência.
  const presencas: Estado["presencas"] = [];
  for (let b = 1; b <= 30; b++) {
    const d = addDias(hojeD, -b);
    aulas.filter((au) => au.dia_semana === d.getDay()).forEach((au) => {
      alunos.filter((a) => a.modalidade === au.nome && a.dias_semana.includes(d.getDay())).forEach((a, i) => {
        if (au.horario === "18:30" && i % 2) return;
        presencas.push({ aula_id: au.id, aluno_id: a.id, data: iso(d), presente: (a.id.length + b * 7 + i * 3) % 6 !== 0 });
      });
    });
  }
  const anamneses = alunos.map((a, i) => ({
    aluno_id: a.id,
    objetivo: ["Hipertrofia e condicionamento", "Emagrecimento", "Flexibilidade e postura", "Ganho de força", "Saúde e mobilidade", "Condicionamento"][i],
    restricoes: ["Dor leve no ombro direito", "Nenhuma", "Hérnia de disco L5", "Hipertensão controlada", "Nenhuma", "Joelho esquerdo (pós-cirurgia, liberado)"][i],
    historico: "Exemplo de histórico de atividade física.", observacoes: "", atualizado_em: hoje(),
  }));
  return { alunos, anamneses, treinos, exercicios, aulas, presencas, avaliacoes, mensalidades: [], concluidos: [] };
}
