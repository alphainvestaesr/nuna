import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tela: "#f5f5f7",
        tinta: "#1d1d1f",
        suave: "#6e6e73",
        campo: "#e8e8ed",
        azul: "#0071e3",
        link: "#0066cc",
        ok: { DEFAULT: "#1d7a3a", fundo: "#e6f4ea" },
        aviso: { DEFAULT: "#8a4600", fundo: "#fdf0e0" },
        perigo: { DEFAULT: "#b3261e", fundo: "#fdecea" },
      },
      fontFamily: {
        sans: ['-apple-system', '"SF Pro Display"', '"Helvetica Neue"', "Helvetica", "sans-serif"],
      },
      borderRadius: { cartao: "24px", grande: "28px" },
    },
  },
  plugins: [],
};
export default config;
