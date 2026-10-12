-- SEED DE EXEMPLO. Todos os nomes e valores são fictícios e levam o sufixo "(exemplo)".
-- Rode depois das migrações. Para apagar: delete from public.alunos where nome like '%(exemplo)';
insert into public.alunos (id, nome, contato, email, nascimento, modalidade, dias_semana, valor_mensalidade, dia_vencimento) values
 ('00000000-0000-0000-0000-000000000001','Marcos Lima (exemplo)','11 98888-1111','marcos@exemplo.com','1990-05-14','Funcional','{1,3,5}',220,extract(day from current_date + 2)::int),
 ('00000000-0000-0000-0000-000000000002','Fernanda Costa (exemplo)','11 97777-2222','fernanda@exemplo.com','1988-09-02','Funcional','{1,3,5}',220,5),
 ('00000000-0000-0000-0000-000000000003','Camila Rocha (exemplo)','11 96666-3333','camila@exemplo.com','1995-01-20','Pilates','{2,4}',170,3),
 ('00000000-0000-0000-0000-000000000004','Roberto Souza (exemplo)','11 95555-4444','roberto@exemplo.com','1975-11-30','Musculação','{2,4,6}',190,20)
on conflict do nothing;

insert into public.anamneses (aluno_id, objetivo, restricoes, historico, observacoes) values
 ('00000000-0000-0000-0000-000000000001','Hipertrofia e condicionamento','Dor leve no ombro direito','Treinou musculação por 2 anos, parado há 6 meses','Prefere treinar cedo'),
 ('00000000-0000-0000-0000-000000000002','Emagrecimento','Nenhuma','Sedentária há 3 anos','Quer evitar impacto no joelho')
on conflict do nothing;

insert into public.treinos (id, aluno_id, nome, foco, duracao_min) values
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000001','A','Inferiores e core',55),
 ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000001','B','Costas e bíceps',50),
 ('10000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000001','C','Peito, ombros e tríceps',50)
on conflict do nothing;

insert into public.exercicios_treino (treino_id, ordem, nome, series, repeticoes, carga, descanso_s) values
 ('10000000-0000-0000-0000-00000000000a',1,'Agachamento livre',4,'10','30 kg',60),
 ('10000000-0000-0000-0000-00000000000a',2,'Afundo com halteres',3,'12','10 kg',45),
 ('10000000-0000-0000-0000-00000000000a',3,'Stiff',3,'12','20 kg',60),
 ('10000000-0000-0000-0000-00000000000a',4,'Prancha',3,'40s','',30),
 ('10000000-0000-0000-0000-00000000000b',1,'Puxada frontal',4,'10','40 kg',60),
 ('10000000-0000-0000-0000-00000000000b',2,'Remada curvada',3,'12','30 kg',60),
 ('10000000-0000-0000-0000-00000000000b',3,'Rosca direta',3,'12','12 kg',45);

insert into public.aulas (nome, horario, dia_semana)
select a.nome, a.horario::time, d from (values ('Funcional','07:00'),('Funcional','18:30')) as a(nome,horario), generate_series(1,5) d;
insert into public.aulas (nome, horario, dia_semana)
select 'Pilates','09:00'::time, d from generate_series(1,5) d;

insert into public.avaliacoes (aluno_id, data, peso, altura, gordura_pct, cintura_cm, outras_medidas)
select '00000000-0000-0000-0000-000000000001', (date_trunc('month', current_date) - (n||' month')::interval)::date,
       82 - (5-n)*0.8, 1.78, 20 - (5-n)*0.6, 88 - (5-n)*1.2, '{"quadril":102,"braco":33}'::jsonb
from generate_series(0,5) n;

insert into public.mensalidades (aluno_id, competencia, vencimento, valor, pago_em)
select id, date_trunc('month', current_date)::date,
       (date_trunc('month', current_date) + ((dia_vencimento-1)||' day')::interval)::date, valor_mensalidade,
       case when nome like 'Fernanda%' then current_date end
from public.alunos where nome like '%(exemplo)'
on conflict do nothing;
