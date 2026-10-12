import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Acompanhamento de Alunos",
  description: "Presença, fichas de treino, mensalidades e evolução dos alunos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Alunos", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f5f5f7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans text-tinta antialiased">
        <AppProvider>{children}</AppProvider>
        <RegistrarSW />
      </body>
    </html>
  );
}
