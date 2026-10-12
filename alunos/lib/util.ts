export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoje = () => iso(new Date());
export const competenciaAtual = () => hoje().slice(0, 7) + "-01";
export const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
export const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x };
export const daIso = (s: string) => new Date(s + "T00:00:00");
export const diasEntre = (a: string, b: string) => Math.round((daIso(a).getTime() - daIso(b).getTime()) / 864e5);
export const iniciais = (nome: string) =>
  nome.replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
export const primeiroNome = (n: string) => n.replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
export const nomeLimpo = (n: string) => n.replace(/\s*\(exemplo\)\s*$/i, "");
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataCurta = (s: string) => daIso(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const mesCurto = (s: string) =>
  daIso(s).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
export const dataExtensa = () =>
  new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
export const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};
export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MODALIDADES = ["Funcional", "Pilates", "Musculação", "Corrida", "Treino personalizado"];
