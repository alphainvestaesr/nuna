-- Esquema do app de acompanhamento de alunos.
create extension if not exists "pgcrypto";

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'aluno' check (papel in ('professora','aluno')),
  nome text not null default ''
);

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references public.perfis(id) on delete set null,
  nome text not null,
  contato text not null default '',
  email text,
  nascimento date,
  modalidade text not null default '',
  dias_semana smallint[] not null default '{}',
  valor_mensalidade numeric(10,2) not null default 0,
  dia_vencimento smallint not null default 10 check (dia_vencimento between 1 and 28),
  ativo boolean not null default true
);

create table public.anamneses (
  aluno_id uuid primary key references public.alunos(id) on delete cascade,
  objetivo text not null default '',
  restricoes text not null default '',
  historico text not null default '',
  observacoes text not null default '',
  atualizado_em timestamptz not null default now()
);

create table public.treinos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  nome text not null check (nome in ('A','B','C')),
  foco text not null default '',
  duracao_min integer not null default 50,
  unique (aluno_id, nome)
);

create table public.exercicios_treino (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid not null references public.treinos(id) on delete cascade,
  ordem integer not null default 1,
  nome text not null,
  series integer not null default 3,
  repeticoes text not null default '12',      -- número ou tempo, ex.: '12' ou '40s'
  carga text not null default '',
  descanso_s integer not null default 60
);

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  horario time not null,
  dia_semana smallint not null check (dia_semana between 0 and 6)
);

create table public.presencas (
  aula_id uuid not null references public.aulas(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  data date not null,
  presente boolean not null default false,
  primary key (aula_id, aluno_id, data)
);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  data date not null,
  peso numeric(5,1),
  altura numeric(4,2),
  gordura_pct numeric(4,1),
  cintura_cm numeric(5,1),
  outras_medidas jsonb not null default '{}'::jsonb,
  observacoes text not null default ''
);

create table public.mensalidades (
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  competencia date not null,                  -- sempre o dia 1 do mês
  vencimento date not null,
  valor numeric(10,2) not null,
  pago_em date,
  aviso_enviado_em timestamptz,
  primary key (aluno_id, competencia)
);

-- Treinos marcados como concluídos pelo aluno.
create table public.treinos_concluidos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  treino_id uuid not null references public.treinos(id) on delete cascade,
  data date not null default current_date,
  unique (aluno_id, treino_id, data)
);

create index on public.treinos (aluno_id);
create index on public.exercicios_treino (treino_id, ordem);
create index on public.presencas (aluno_id, data);
create index on public.avaliacoes (aluno_id, data);

-- Cria o perfil quando alguém se cadastra e vincula ao aluno pelo e-mail.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, papel, nome)
  values (new.id, 'aluno', coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));
  update public.alunos set perfil_id = new.id
   where perfil_id is null and lower(email) = lower(new.email);
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
for each row execute function public.novo_usuario();
