-- Row Level Security: a professora acessa tudo; o aluno só as linhas ligadas ao seu aluno_id.
create or replace function public.eh_professora() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'professora');
$$;

create or replace function public.meu_aluno_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.alunos where perfil_id = auth.uid();
$$;

alter table public.perfis enable row level security;
alter table public.alunos enable row level security;
alter table public.anamneses enable row level security;
alter table public.treinos enable row level security;
alter table public.exercicios_treino enable row level security;
alter table public.aulas enable row level security;
alter table public.presencas enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.mensalidades enable row level security;
alter table public.treinos_concluidos enable row level security;

-- Professora: acesso total.
create policy prof_perfis on public.perfis for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_alunos on public.alunos for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_anamneses on public.anamneses for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_treinos on public.treinos for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_exercicios on public.exercicios_treino for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_aulas on public.aulas for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_presencas on public.presencas for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_avaliacoes on public.avaliacoes for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_mensalidades on public.mensalidades for all using (public.eh_professora()) with check (public.eh_professora());
create policy prof_concluidos on public.treinos_concluidos for all using (public.eh_professora()) with check (public.eh_professora());

-- Aluno: só o que é seu.
create policy aluno_perfil on public.perfis for select using (id = auth.uid());
create policy aluno_proprio on public.alunos for select using (perfil_id = auth.uid());
create policy aluno_anamnese on public.anamneses for select using (aluno_id = public.meu_aluno_id());
create policy aluno_treinos on public.treinos for select using (aluno_id = public.meu_aluno_id());
create policy aluno_exercicios on public.exercicios_treino for select
  using (treino_id in (select id from public.treinos where aluno_id = public.meu_aluno_id()));
create policy aluno_aulas on public.aulas for select using (auth.uid() is not null);
create policy aluno_presencas on public.presencas for select using (aluno_id = public.meu_aluno_id());
create policy aluno_avaliacoes on public.avaliacoes for select using (aluno_id = public.meu_aluno_id());
create policy aluno_mensalidades on public.mensalidades for select using (aluno_id = public.meu_aluno_id());
create policy aluno_concluidos_ler on public.treinos_concluidos for select using (aluno_id = public.meu_aluno_id());
create policy aluno_concluidos_marcar on public.treinos_concluidos for insert
  with check (aluno_id = public.meu_aluno_id()
    and treino_id in (select id from public.treinos where aluno_id = public.meu_aluno_id()));
create policy aluno_concluidos_desfazer on public.treinos_concluidos for delete using (aluno_id = public.meu_aluno_id());
