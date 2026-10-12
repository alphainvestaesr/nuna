import { mesCurto } from "@/lib/util";

export interface Ponto { data: string; valor: number }

/** Gráfico de linha simples em SVG, com eixo de meses. */
export default function Grafico({ pontos, unidade, rotulo }: { pontos: Ponto[]; unidade: string; rotulo: string }) {
  if (pontos.length < 2) return <p className="text-[15px] text-suave">Registre ao menos duas avaliações para ver o gráfico.</p>;
  const W = 340, H = 150, L = 8, R = 8, T = 14, B = 26;
  const vs = pontos.map((p) => p.valor);
  const mn = Math.min(...vs), mx = Math.max(...vs), folga = (mx - mn || 1) * 0.25;
  const lo = mn - folga, hi = mx + folga;
  const X = (i: number) => L + (i * (W - L - R)) / (pontos.length - 1);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const linha = pontos.map((p, i) => `${X(i)},${Y(p.valor)}`).join(" ");
  const ult = pontos[pontos.length - 1];
  const descricao = `${rotulo}: de ${pontos[0].valor} a ${ult.valor} ${unidade} em ${pontos.length} medições`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={descricao}>
      {[0, 0.5, 1].map((t) => <line key={t} x1={L} x2={W - R} y1={T + t * (H - T - B)} y2={T + t * (H - T - B)} stroke="#e8e8ed" />)}
      <polygon points={`${L},${H - B} ${linha} ${X(pontos.length - 1)},${H - B}`} fill="#0071e3" opacity="0.08" />
      <polyline points={linha} fill="none" stroke="#0071e3" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <g key={p.data}>
          <circle cx={X(i)} cy={Y(p.valor)} r={i === pontos.length - 1 ? 5 : 3} fill="#0071e3" />
          <text x={X(i)} y={H - 7} textAnchor="middle" fontSize="11" fill="#6e6e73">{mesCurto(p.data)}</text>
        </g>
      ))}
    </svg>
  );
}
