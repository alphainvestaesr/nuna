"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BarraAbas from "@/components/BarraAbas";
import { useApp } from "@/lib/store";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  const { pronto, sessao, erro } = useApp();
  const router = useRouter();
  useEffect(() => { if (pronto && !sessao) router.replace("/login"); }, [pronto, sessao, router]);
  if (!pronto || !sessao) return <p className="p-8 text-center text-suave" role="status">Carregando…</p>;
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28">
      {erro && <p role="alert" className="mt-4 rounded-[14px] bg-perigo-fundo p-3 text-[14px] text-perigo">{erro}</p>}
      {children}
      <BarraAbas />
    </div>
  );
}
