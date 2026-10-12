import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as variáveis de ambiente o app roda em modo demonstração. */
export const supabaseConfigurado = Boolean(url && key);

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigurado) return null;
  if (!cliente) cliente = createBrowserClient(url!, key!);
  return cliente;
}
