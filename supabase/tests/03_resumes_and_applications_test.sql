-- Testes da Fase 2: currículo, candidatura pelo link, funil e fila de e-mails.

\set ON_ERROR_STOP 1

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000201', 'carla@test', '{"full_name": "Carla Souza", "role": "candidate", "city_id": "3106200"}'),
  ('00000000-0000-0000-0000-000000000202', 'diego@test', '{"full_name": "Diego Lima", "role": "candidate"}');

-- Vaga publicada da Loja Alfa (Fase 1) com perguntas: 1ª obrigatória (sim/não), 2ª obrigatória (sim/não)
create temporary table vaga as
select id, (select array_agg(q.id order by q.position) from public.job_questions q where q.job_id = j.id) as perguntas
from public.jobs j where j.title = 'Vendedor de Loja';
grant select on vaga to authenticated, anon;
update public.job_questions set type = 'single_choice', options = array['Manhã', 'Tarde'], is_required = false
where id = (select perguntas[2] from vaga);

-- ---------------------------------------------------------------------------
-- Currículo
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', false);

select public.save_resume(
  '{"full_name": "Carla Souza Lima", "phone": "(31) 98888-1111", "city_id": "3106200"}'::jsonb,
  jsonb_build_object('headline', 'Vendedora', 'objective', 'Atuar com vendas no varejo', 'education_level', 'high_school',
                     'desired_salary', '2200', 'languages', '[{"language": "Inglês", "level": "basic"}]'::jsonb,
                     'area_id', (select id from public.areas where slug = 'varejo')),
  '[{"company_name": "Loja X", "role_title": "Vendedora", "started_on": "2022-01-01", "ended_on": "2023-12-31"},
    {"company_name": "Loja Y", "role_title": "Caixa", "started_on": "2023-06-01", "is_current": true, "ended_on": "2020-01-01"}]'::jsonb,
  '[{"course": "Ensino médio", "institution": "Escola Estadual", "level": "high_school", "ended_on": "2021-12-01"},
    {"course": "Técnicas de vendas", "institution": "SENAC", "level": "technical", "is_course": true}]'::jsonb,
  (select jsonb_agg(jsonb_build_object('skill_id', id, 'level', 'advanced')) from public.skills where slug in ('vendas', 'operacao-de-caixa'))
);

select test.check(
  (select full_name || '|' || phone from public.profiles where id = '00000000-0000-0000-0000-000000000201') = 'Carla Souza Lima|31988881111',
  'currículo atualiza nome e telefone do perfil'
);
select test.check(
  (select count(*) from public.resume_experiences) = 2
  and (select ended_on from public.resume_experiences where is_current) is null,
  'experiência atual ignora data de saída'
);
select test.check(
  (select count(*) from public.resume_education) = 2 and (select count(*) from public.resume_skills) = 2,
  'formação, cursos e habilidades gravados'
);
-- 2022-01 a 2023-12 e 2023-06 até hoje se sobrepõem: conta de 2022-01 até hoje uma única vez.
select test.check(
  public.resume_experience_months((select id from public.resumes))
    = (select (extract(year from age(current_date, date '2022-01-01')) * 12 + extract(month from age(current_date, date '2022-01-01')))::integer),
  'tempo de experiência em meses de calendário, sem contar sobreposição duas vezes'
);

-- Salvar de novo substitui as listas
select public.save_resume(
  '{"full_name": "Carla Souza Lima", "phone": "31988881111", "city_id": "3106200"}'::jsonb,
  '{"headline": "Vendedora"}'::jsonb,
  '[{"company_name": "Loja X", "role_title": "Vendedora", "started_on": "2022-01-01", "ended_on": "2023-12-31"}]'::jsonb
);
select test.check(
  (select count(*) from public.resume_experiences) = 1 and (select count(*) from public.resume_skills) = 0,
  'salvar o currículo substitui experiências e habilidades'
);

-- ---------------------------------------------------------------------------
-- Candidatura
-- ---------------------------------------------------------------------------
select test.expect_error(
  $$select public.apply_to_job((select id from vaga), '[]'::jsonb, 'whatsapp', null)$$,
  'autorizar'
);
select test.expect_error(
  $$select public.apply_to_job((select id from vaga), '[]'::jsonb, 'whatsapp', 'v1')$$,
  'responda à pergunta'
);
select test.expect_error(
  $$select public.apply_to_job((select id from vaga),
      jsonb_build_array(jsonb_build_object('question_id', (select perguntas[1] from vaga), 'answer', 'Talvez')), 'whatsapp', 'v1')$$,
  'resposta inválida'
);
select test.expect_error(
  $$select public.apply_to_job((select id from vaga), jsonb_build_array(
      jsonb_build_object('question_id', (select perguntas[1] from vaga), 'answer', 'Sim'),
      jsonb_build_object('question_id', (select perguntas[2] from vaga), 'answer', 'Noite')), 'whatsapp', 'v1')$$,
  'resposta inválida'
);

select public.apply_to_job(
  (select id from vaga),
  jsonb_build_array(
    jsonb_build_object('question_id', (select perguntas[1] from vaga), 'answer', 'Sim'),
    jsonb_build_object('question_id', (select perguntas[2] from vaga), 'answer', 'Tarde')
  ),
  'WhatsApp',
  '2026-10-08'
);

select test.check(
  (select source || '|' || source_detail || '|' || stage from public.applications) = 'link|whatsapp|new',
  'candidatura registra origem do link'
);
select test.check((select count(*) from public.application_answers) = 2, 'respostas de triagem gravadas');
select test.check(
  exists (select 1 from public.consents where purpose = 'application' and job_id = (select id from vaga)),
  'consentimento de envio à empresa registrado com a vaga'
);
select test.check(
  (select count(*) from public.notifications where template = 'application_received') = 1,
  'candidata recebe confirmação da candidatura'
);
select test.expect_error(
  $$select public.apply_to_job((select id from vaga), jsonb_build_array(jsonb_build_object('question_id', (select perguntas[1] from vaga), 'answer', 'Sim')), null, 'v1')$$,
  'já se candidatou'
);
update public.applications set stage = 'approved';
select test.check((select stage from public.applications) = 'new', 'candidata não altera a etapa');

-- Candidato sem currículo: a candidatura cria o currículo mínimo
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', false);
select public.apply_to_job(
  (select id from vaga),
  jsonb_build_array(jsonb_build_object('question_id', (select perguntas[1] from vaga), 'answer', 'Não')),
  null,
  '2026-10-08'
);
select test.check(
  (select count(*) from public.resumes) = 1 and (select count(*) from public.applications) = 1,
  'candidatura cria currículo mínimo e candidato vê só a própria'
);

-- Empresa não pode se candidatar
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
select test.expect_error(
  $$select public.apply_to_job((select id from vaga), '[]'::jsonb, null, 'v1')$$,
  'apenas candidatos'
);

-- ---------------------------------------------------------------------------
-- Funil da empresa
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select count(*) from public.applications where job_id = (select id from vaga)) = 2,
  'recrutador vê as candidaturas da vaga'
);
select test.check(
  (select count(*) from public.notifications where template = 'new_application') = 2,
  'recrutador recebe aviso de cada nova candidatura'
);
select test.check(
  (select count(*) from public.application_answers) = 3,
  'empresa vê as respostas de triagem'
);
select test.check(
  (select phone from public.profiles where id = '00000000-0000-0000-0000-000000000201') = '31988881111',
  'empresa vê o contato de quem se candidatou'
);
update public.applications set stage = 'reviewing' where resume_id = (select id from public.resumes where profile_id = '00000000-0000-0000-0000-000000000201');
update public.applications set stage = 'interview', rating = 5 where resume_id = (select id from public.resumes where profile_id = '00000000-0000-0000-0000-000000000201');
insert into public.application_notes (application_id, body)
select id, 'Ótima entrevista por telefone' from public.applications where rating = 5;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
select test.check((select count(*) from public.applications) = 0, 'outra empresa não vê as candidaturas');
select test.check((select count(*) from public.application_answers) = 0, 'outra empresa não vê as respostas');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', false);
select test.check(
  (select count(*) from public.notifications where template = 'application_stage_changed') = 1
  and (select payload ->> 'stage' from public.notifications where template = 'application_stage_changed') = 'interview',
  'candidata é avisada da entrevista, mas não da etapa interna "em análise"'
);
select test.check((select count(*) from public.application_notes) = 0, 'candidata não vê anotações internas');

-- ---------------------------------------------------------------------------
-- Fila de e-mails
-- ---------------------------------------------------------------------------
select test.expect_error($$select * from public.claim_notifications(10)$$, 'permission denied');

reset role;
set role service_role;
create temporary table lote as select * from public.claim_notifications(500);
select test.check(
  (select count(*) from lote) > 0 and not exists (select 1 from lote where status <> 'sending'),
  'lote reservado fica como "enviando"'
);
select test.check(
  (select count(*) from public.claim_notifications(500)) = 0,
  'mensagens reservadas não são entregues a outro processo'
);
select public.finish_notification((select id from lote order by created_at limit 1), true);
select public.finish_notification((select id from lote order by created_at offset 1 limit 1), false, 'caixa cheia');
select test.check(
  (select status from public.notifications where id = (select id from lote order by created_at limit 1)) = 'sent',
  'envio confirmado marca como enviado'
);
select test.check(
  (select status || '|' || error from public.notifications where id = (select id from lote order by created_at offset 1 limit 1)) = 'queued|caixa cheia',
  'falha devolve para a fila com o erro registrado'
);

\echo
