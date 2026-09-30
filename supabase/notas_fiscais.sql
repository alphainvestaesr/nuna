-- ============================================================
-- NuNa · notas_fiscais.sql
-- Notas fiscais lidas por QR Code / codigo de barras (NFC-e) e seus itens.
-- Mesmo padrao das demais tabelas: grant so para authenticated + RLS por household.
-- Rode no SQL Editor do Supabase.
-- ============================================================
create table if not exists public.notas_fiscais (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  chave          text not null,
  url            text,
  uf             text,
  cnpj           text,
  emitente       text,
  data_emissao   timestamptz,
  mes_ref        text,                       -- AAAA-MM (da chave), usado enquanto nao ha data de emissao
  total          numeric(14,2),
  itens          jsonb not null default '[]'::jsonb,   -- [{desc,qtd,un,unit,total}]
  status         text not null default 'pendente' check (status in ('lida', 'pendente')),
  erro           text,
  lida_por       text,
  criado_em      timestamptz not null default now(),
  unique (household_id, chave)
);

create index if not exists notas_fiscais_household_idx on public.notas_fiscais (household_id, data_emissao desc);

grant select, insert, update, delete on public.notas_fiscais to authenticated;
alter table public.notas_fiscais enable row level security;

drop policy if exists notas_fiscais_rw on public.notas_fiscais;
create policy notas_fiscais_rw on public.notas_fiscais
  for all to authenticated
  using (household_id = public.nuna_household())
  with check (household_id = public.nuna_household());
