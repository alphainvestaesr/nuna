-- ============================================================
-- NuNa · schema.sql
-- Projeto criado com "Expor automaticamente novas tabelas" DESATIVADO
-- e "RLS automatico" ATIVADO. Por isso cada tabela abaixo tem:
--   1. GRANT explicito e minimo apenas para o role authenticated
--      (NENHUM grant para anon);
--   2. ENABLE ROW LEVEL SECURITY;
--   3. policies proprias, todas checando participacao no household
--      via auth.uid().
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- Nenhum acesso ao schema public para visitantes sem login.
revoke all on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated;

-- ============================================================
-- 1. Household e membros
-- ============================================================
create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  criado_em  timestamptz not null default now()
);

create table if not exists public.membros (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  perfil        text not null check (perfil in ('Ana', 'Manuela')),
  nome          text,
  email         text,
  criado_em     timestamptz not null default now(),
  unique (household_id, perfil)
);

create index if not exists membros_household_idx on public.membros (household_id);

-- ------------------------------------------------------------
-- Funcoes de apoio (security definer para nao recair em RLS)
-- ------------------------------------------------------------
create or replace function public.nuna_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.membros where id = auth.uid()
$$;

create or replace function public.nuna_perfil()
returns text language sql stable security definer set search_path = public as $$
  select perfil from public.membros where id = auth.uid()
$$;

-- ############################################################
-- PONTO UNICO DE AJUSTE DA VISIBILIDADE DOS DADOS INDIVIDUAIS
-- ------------------------------------------------------------
-- Comportamento atual do site: quem esta logada ve o CONJUNTO e o
-- proprio perfil individual (a interface ja esconde o perfil da outra).
-- No banco, as duas membras do mesmo household leem as linhas do
-- household — e o suficiente para bloquear visitante e conta de fora.
--
-- Para isolamento ESTRITO no banco (Ana nunca le uma linha INDIVIDUAL
-- da Manuela, nem pelo console), troque o corpo desta funcao por:
--
--   select p_divisao = 'CONJUNTA'
--       or p_perfil_dono is null
--       or p_perfil_dono = 'NuNa'
--       or p_perfil_dono = public.nuna_perfil();
--
-- Atencao: com o modo estrito, a base importada em base_documento
-- continua sendo um documento unico do household — separe a base por
-- perfil antes de ativar, senao o isolamento fica so nas linhas novas.
-- ############################################################
create or replace function public.nuna_pode_ver(p_perfil_dono text, p_divisao text)
returns boolean language sql stable as $$
  select true
$$;

grant select on public.households to authenticated;
grant select on public.membros to authenticated;

alter table public.households enable row level security;
alter table public.membros enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (id = public.nuna_household());

drop policy if exists membros_select on public.membros;
create policy membros_select on public.membros
  for select to authenticated
  using (household_id = public.nuna_household());

-- ============================================================
-- 2. Base consolidada (documento importado uma unica vez)
-- ============================================================
create table if not exists public.base_documento (
  household_id  uuid primary key references public.households(id) on delete cascade,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.base_documento to authenticated;
alter table public.base_documento enable row level security;

drop policy if exists base_documento_rw on public.base_documento;
create policy base_documento_rw on public.base_documento
  for all to authenticated
  using (household_id = public.nuna_household())
  with check (household_id = public.nuna_household());

-- ============================================================
-- 3. Transacoes (linhas importadas de CSV) e gastos rapidos
--    Mesmas colunas nas duas tabelas: o app trata as duas do
--    mesmo jeito e um app nativo pode reusar sem adaptacao.
-- ============================================================
create table if not exists public.transacoes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  uid           text not null,
  mes           text,
  data_iso      date,
  data_br       text,
  descricao     text,
  raw           text,
  valor         numeric(14,2),
  fonte         text,
  fonte_label   text,
  plano         text,
  tipo          text,
  grupo         text,
  divisao       text check (divisao in ('INDIVIDUAL', 'CONJUNTA')),
  pago_por      text,
  perfil_dono   text,
  revisar       boolean not null default false,
  conferido     boolean not null default false,
  status        text,
  dedup_key     text,
  extra         jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  unique (household_id, uid)
);

-- Deduplicacao: mes|fonteLabel|data|descricao|valor
create unique index if not exists transacoes_dedup_idx
  on public.transacoes (household_id, dedup_key) where dedup_key is not null;
create index if not exists transacoes_mes_idx     on public.transacoes (household_id, mes);
create index if not exists transacoes_dono_idx    on public.transacoes (household_id, perfil_dono);
create index if not exists transacoes_divisao_idx on public.transacoes (household_id, divisao);
create index if not exists transacoes_revisar_idx on public.transacoes (household_id, revisar);

create table if not exists public.gastos (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  uid           text not null,
  mes           text,
  data_iso      date,
  data_br       text,
  descricao     text,
  raw           text,
  valor         numeric(14,2),
  fonte         text,
  fonte_label   text,
  plano         text,
  tipo          text,
  grupo         text,
  divisao       text check (divisao in ('INDIVIDUAL', 'CONJUNTA')),
  pago_por      text,
  perfil_dono   text,
  revisar       boolean not null default false,
  conferido     boolean not null default false,
  status        text,
  dedup_key     text,
  extra         jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  unique (household_id, uid)
);

create index if not exists gastos_mes_idx    on public.gastos (household_id, mes);
create index if not exists gastos_dono_idx   on public.gastos (household_id, perfil_dono);
create index if not exists gastos_status_idx on public.gastos (household_id, status);

grant select, insert, update, delete on public.transacoes to authenticated;
grant select, insert, update, delete on public.gastos to authenticated;

alter table public.transacoes enable row level security;
alter table public.gastos     enable row level security;

drop policy if exists transacoes_select on public.transacoes;
create policy transacoes_select on public.transacoes
  for select to authenticated
  using (household_id = public.nuna_household()
         and public.nuna_pode_ver(perfil_dono, divisao));

drop policy if exists transacoes_escrita on public.transacoes;
create policy transacoes_escrita on public.transacoes
  for all to authenticated
  using (household_id = public.nuna_household())
  with check (household_id = public.nuna_household());

drop policy if exists gastos_select on public.gastos;
create policy gastos_select on public.gastos
  for select to authenticated
  using (household_id = public.nuna_household()
         and public.nuna_pode_ver(perfil_dono, divisao));

drop policy if exists gastos_escrita on public.gastos;
create policy gastos_escrita on public.gastos
  for all to authenticated
  using (household_id = public.nuna_household())
  with check (household_id = public.nuna_household());

-- ============================================================
-- 4. Correcoes manuais, revisao e demais colecoes do household
-- ============================================================
create table if not exists public.overrides (
  household_id  uuid not null references public.households(id) on delete cascade,
  uid           text not null,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (household_id, uid)
);

create table if not exists public.revisados (
  household_id  uuid not null references public.households(id) on delete cascade,
  uid           text not null,
  conferido_em  timestamptz not null default now(),
  primary key (household_id, uid)
);

create table if not exists public.orcamentos (
  household_id  uuid not null references public.households(id) on delete cascade,
  perfil        text not null,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (household_id, perfil)
);

create table if not exists public.transferencias (
  household_id  uuid not null references public.households(id) on delete cascade,
  chave         text not null,
  criado_em     timestamptz not null default now(),
  primary key (household_id, chave)
);

create table if not exists public.fechamentos (
  household_id  uuid not null references public.households(id) on delete cascade,
  mes           text not null,
  fechado_em    timestamptz not null default now(),
  primary key (household_id, mes)
);

create table if not exists public.contribuicoes (
  household_id  uuid not null references public.households(id) on delete cascade,
  ordem         integer not null,
  dados         jsonb not null,
  criado_em     timestamptz not null default now(),
  primary key (household_id, ordem)
);

create index if not exists overrides_household_idx      on public.overrides (household_id);
create index if not exists revisados_household_idx      on public.revisados (household_id);
create index if not exists orcamentos_household_idx     on public.orcamentos (household_id);
create index if not exists transferencias_household_idx on public.transferencias (household_id);
create index if not exists fechamentos_household_idx    on public.fechamentos (household_id);
create index if not exists contribuicoes_household_idx  on public.contribuicoes (household_id);

do $$
declare t text;
begin
  foreach t in array array['overrides','revisados','orcamentos','transferencias','fechamentos','contribuicoes']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (household_id = public.nuna_household())
         with check (household_id = public.nuna_household())', t || '_rw', t);
  end loop;
end $$;

-- ============================================================
-- 5. Preferencias (por usuaria)
-- ============================================================
create table if not exists public.preferencias (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid references public.households(id) on delete cascade,
  tema          jsonb,
  prefs         jsonb,
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.preferencias to authenticated;
alter table public.preferencias enable row level security;

drop policy if exists preferencias_rw on public.preferencias;
create policy preferencias_rw on public.preferencias
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 6. Realtime (as duas usuarias veem o lancamento da outra)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['base_documento','transacoes','gastos','overrides','revisados',
                           'orcamentos','transferencias','fechamentos','contribuicoes']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================
-- 7. SEED — preencher os dois e-mails e rodar
--    As contas de Ana e Manuela ja devem existir em Authentication.
-- ============================================================
do $$
declare
  v_household uuid;
  v_ana       uuid;
  v_manuela   uuid;
  email_ana     text := 'alphainvest.aesr@gmail.com';     
  email_manuela text := 'manuelajessica17@gmail.com';  
begin
  select id into v_household from public.households where nome = 'NuNa';
  if v_household is null then
    insert into public.households (nome) values ('NuNa') returning id into v_household;
  end if;

  select id into v_ana     from auth.users where lower(email) = lower(email_ana);
  select id into v_manuela from auth.users where lower(email) = lower(email_manuela);

  if v_ana is null or v_manuela is null then
    raise notice 'Conta nao encontrada em auth.users. Crie Ana e Manuela em Authentication e rode este bloco de novo.';
  end if;

  if v_ana is not null then
    insert into public.membros (id, household_id, perfil, nome, email)
    values (v_ana, v_household, 'Ana', 'Ana', email_ana)
    on conflict (id) do update set household_id = excluded.household_id,
                                   perfil = excluded.perfil,
                                   nome = excluded.nome,
                                   email = excluded.email;
  end if;

  if v_manuela is not null then
    insert into public.membros (id, household_id, perfil, nome, email)
    values (v_manuela, v_household, 'Manuela', 'Manuela', email_manuela)
    on conflict (id) do update set household_id = excluded.household_id,
                                   perfil = excluded.perfil,
                                   nome = excluded.nome,
                                   email = excluded.email;
  end if;
end $$;
