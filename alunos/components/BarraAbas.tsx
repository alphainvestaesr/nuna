"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcAlunos, IcEvolucao, IcInicio, IcTreinos } from "./ui";
import { useApp } from "@/lib/store";

const ABAS = [
  { href: "/", nome: "Início", Icone: IcInicio, prof: true },
  { href: "/alunos", nome: "Alunos", Icone: IcAlunos, prof: false },
  { href: "/treinos", nome: "Treinos", Icone: IcTreinos, prof: true },
  { href: "/evolucao", nome: "Evolução", Icone: IcEvolucao, prof: true },
];

export default function BarraAbas() {
  const path = usePathname();
  const { sessao } = useApp();
  const abas = ABAS.filter((a) => a.prof || sessao?.papel === "professora");
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/80 backdrop-blur-xl backdrop-saturate-150" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto flex max-w-xl">
        {abas.map(({ href, nome, Icone }) => {
          const ativa = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={ativa ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${ativa ? "text-azul" : "text-suave"}`}>
                <Icone />{nome}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
