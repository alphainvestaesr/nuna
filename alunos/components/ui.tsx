import type { ReactNode, SVGProps } from "react";
import { iniciais } from "@/lib/util";

type Ic = SVGProps<SVGSVGElement>;
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const IcInicio = (p: Ic) => <svg {...base} {...p}><path d="M3.5 11 12 4l8.5 7M5.5 9.8V20h13V9.8M10 20v-5.5h4V20" /></svg>;
export const IcAlunos = (p: Ic) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.8 20c0-3.5 2.8-5.8 6.2-5.8s6.2 2.3 6.2 5.8M16 5a3.5 3.5 0 0 1 0 6.5M18.2 14.6c2 .8 3.2 2.6 3.2 5.4" /></svg>;
export const IcTreinos = (p: Ic) => <svg {...base} {...p}><path d="M2.5 12h2M19.5 12h2M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8" /></svg>;
export const IcEvolucao = (p: Ic) => <svg {...base} {...p}><path d="M3.5 20.5h17M5 16l4.2-5.2 3.6 3L19 6.5M15 6.5h4v4" /></svg>;
export const IcCheck = (p: Ic) => <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IcMais = (p: Ic) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const IcBusca = (p: Ic) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
export const IcVoltar = (p: Ic) => <svg {...base} {...p}><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></svg>;

export function Cartao({ children, className = "", escuro = false }: { children: ReactNode; className?: string; escuro?: boolean }) {
  return <section className={`${escuro ? "bg-tinta text-tela rounded-grande" : "bg-white rounded-cartao"} p-5 ${className}`}>{children}</section>;
}

export function Selo({ tipo, children }: { tipo: "ok" | "aviso" | "atraso" | "neutro"; children: ReactNode }) {
  const cls = { ok: "bg-ok-fundo text-ok", aviso: "bg-aviso-fundo text-aviso", atraso: "bg-perigo-fundo text-perigo", neutro: "bg-campo text-suave" }[tipo];
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${cls}`}>{children}</span>;
}

export function Avatar({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-campo font-semibold text-suave ${grande ? "h-14 w-14 text-[18px]" : "h-11 w-11 text-[15px]"}`}>
      {iniciais(nome)}
    </span>
  );
}

export function Segmentado<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: { id: T; nome: string }[]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex rounded-[12px] bg-campo p-[3px]">
      {opcoes.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)}
          className={`min-h-[40px] flex-1 rounded-[10px] px-2 text-[15px] font-semibold transition ${valor === o.id ? "bg-white text-tinta shadow-sm" : "text-suave"}`}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}

export function Campo({ rotulo, id, children }: { rotulo: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="rotulo">{rotulo}</label>
      {children}
    </div>
  );
}

export function Cabecalho({ rotulo, titulo, acao }: { rotulo: string; titulo: string; acao?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-6">
      <div className="min-w-0">
        <p className="rotulo">{rotulo}</p>
        <h1 className="titulo mt-1 break-words">{titulo}</h1>
      </div>
      {acao}
    </header>
  );
}
