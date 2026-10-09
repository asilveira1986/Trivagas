-- Testes da Fase 5: vagas confidenciais e afirmativas, declaração de deficiência, alertas, WhatsApp e relatórios.

\set ON_ERROR_STOP 1

reset role;
delete from public.notifications;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000501', 'pcd@test', '{"full_name": "Paula Dias", "role": "candidate", "city_id": "3106200", "phone": "31955554444"}'),
  ('00000000-0000-0000-0000-000000000502', 'alerta@test', '{"full_name": "Rui Alerta", "role": "candidate", "city_id": "3106200"}');

-- Vagas da Loja Alfa: uma confidencial e uma afirmativa PcD, ambas publicadas em BH
insert into public.jobs (company_id, title, description, contract_type, work_mode, city_id, status, is_confidential, affirmative)
select c.id, x.title, 'Descrição da vaga', 'clt', 'on_site', 3106200, 'published', x.conf, x.aff::public.affirmative_kind
from public.companies c,
  (values ('Gerente Sigiloso', true, null), ('Assistente PcD', false, 'pcd')) as x(title, conf, aff)
where c.trade_name = 'Loja Alfa';

create temporary table v5 as select id, title, slug from public.jobs where title in ('Gerente Sigiloso', 'Assistente PcD', 'Vendedor Externo');
grant select on v5 to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vaga confidencial
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test.check(
  not exists (select 1 from public.jobs where title = 'Gerente Sigiloso'),
  'vaga confidencial não é lida direto pela API (empresa ficaria exposta)'
);
select test.check(
  (select public.public_job((select slug from v5 where title = 'Gerente Sigiloso')) #>> '{companies,trade_name}') = 'Empresa confidencial'
  and (select public.public_job((select slug from v5 where title = 'Gerente Sigiloso')) #>> '{companies,slug}') is null
  and (select public.public_job((select slug from v5 where title = 'Gerente Sigiloso')) ->> 'company_id') is null,
  'página pública da vaga confidencial oculta a empresa'
);
select test.check(
  (select company_name || '|' || coalesce(company_slug, '-') from public.search_jobs(query => 'gerente')) = 'Empresa confidencial|-',
  'busca pública mostra a vaga confidencial sem a empresa'
);
select test.check(
  (select count(*) from public.public_job_slugs() where slug = (select slug from v5 where title = 'Gerente Sigiloso')) = 1,
  'vaga confidencial entra no sitemap'
);
select test.check(
  (select public.public_job((select slug from v5 where title = 'Assistente PcD')) #>> '{companies,trade_name}') = 'Loja Alfa',
  'vaga comum continua mostrando a empresa'
);

-- ---------------------------------------------------------------------------
-- Vaga afirmativa
-- ---------------------------------------------------------------------------
select test.check(
  (select array_agg(title) from public.search_jobs(affirmative_only => true)) = array['Assistente PcD'],
  'filtro de vagas afirmativas'
);

-- ---------------------------------------------------------------------------
-- Declaração de deficiência
-- ---------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', false);
select public.save_resume('{"full_name": "Paula Dias", "phone": "31955554444", "city_id": "3106200"}'::jsonb, '{"headline": "Assistente"}'::jsonb);
insert into public.resume_disability (resume_id, details, needs_accommodation, consent_version)
select id, 'Deficiência auditiva (laudo disponível)', 'Intérprete de Libras em entrevistas', '2026-10-13' from public.resumes;
select test.check(
  (select array_agg(granted) from public.consents where purpose = 'disability_data') = array[true],
  'declaração registra o consentimento específico'
);
select public.apply_to_job((select id from v5 where title = 'Assistente PcD'), '[]'::jsonb, null, '2026-10-10');
select public.apply_to_job((select id from v5 where title = 'Gerente Sigiloso'), '[]'::jsonb, null, '2026-10-10');
select test.check(
  (select payload ->> 'company_name' from public.notifications
   where template = 'application_received' and payload ->> 'job_title' = 'Gerente Sigiloso') = 'Empresa confidencial',
  'e-mail ao candidato não revela a empresa da vaga confidencial'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select details from public.resume_disability) = 'Deficiência auditiva (laudo disponível)',
  'empresa da vaga PcD vê a declaração de quem se candidatou'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select test.check((select count(*) from public.resume_disability) = 0, 'outra empresa não vê a declaração');

-- Candidatura só a vaga comum não libera a declaração
reset role;
update public.jobs set affirmative = null where title = 'Assistente PcD';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check((select count(*) from public.resume_disability) = 0, 'sem vaga PcD, a declaração fica oculta para a empresa');
reset role;
update public.jobs set affirmative = 'pcd' where title = 'Assistente PcD';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', false);
delete from public.resume_disability;
select test.check(
  (select array_agg(granted order by created_at) from public.consents where purpose = 'disability_data') = array[true, false],
  'apagar a declaração registra a retirada do consentimento'
);

-- ---------------------------------------------------------------------------
-- WhatsApp
-- ---------------------------------------------------------------------------
select test.expect_error($$select public.set_whatsapp_opt_in(true)$$, 'termo do WhatsApp');
update public.profiles set whatsapp_opt_in = true where id = '00000000-0000-0000-0000-000000000501';
select test.check(
  not (select whatsapp_opt_in from public.profiles where id = '00000000-0000-0000-0000-000000000501'),
  'autorização do WhatsApp só pela função (com consentimento)'
);
select public.set_whatsapp_opt_in(true, '2026-10-13');
select test.check(
  (select whatsapp_opt_in from public.profiles where id = '00000000-0000-0000-0000-000000000501')
  and exists (select 1 from public.consents where purpose = 'whatsapp' and granted),
  'candidata autorizou o WhatsApp'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
update public.applications set stage = 'interview'
where job_id = (select id from v5 where title = 'Assistente PcD');

reset role;
select test.check(
  (select to_address from public.notifications where channel = 'whatsapp' and template = 'application_stage_changed') = '+5531955554444',
  'mudança para entrevista também vai por WhatsApp, no formato internacional'
);
select test.check(
  not exists (select 1 from public.notifications where channel = 'whatsapp' and template = 'application_received'),
  'só os avisos com mensagem aprovada vão por WhatsApp'
);
set role service_role;
select test.check(
  (select bool_and(channel = 'whatsapp') and count(*) = 1 from public.claim_notifications(50, 'whatsapp')),
  'fila de WhatsApp reservada separadamente'
);
reset role;

-- ---------------------------------------------------------------------------
-- Alertas de vagas
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', false);
insert into public.job_alerts (name, query, city_id, radius_km) values ('Vendas em BH', 'vendedor', 3106200, 30);
select test.check(
  (select last_sent_at is not null and profile_id = '00000000-0000-0000-0000-000000000502' from public.job_alerts),
  'alerta só considera vagas publicadas depois da criação'
);
insert into public.job_alerts (name) select 'Alerta ' || g from generate_series(2, 5) g;
select test.expect_error($$insert into public.job_alerts (name) values ('Sexto')$$, 'limite de 5');

-- Vaga nova compatível publicada depois do alerta (simula alerta criado ontem)
reset role;
update public.job_alerts set last_sent_at = now() - interval '1 day' where name = 'Vendas em BH';
update public.job_alerts set active = false where name like 'Alerta %';
update public.jobs set published_at = now() - interval '3 days' where status = 'published';
insert into public.jobs (company_id, title, description, contract_type, work_mode, city_id, status)
select id, 'Vendedor Interno', 'Vendas por telefone', 'clt', 'on_site', 3118601, 'published' from public.companies where trade_name = 'Loja Alfa';
set role service_role;
select test.check(public.queue_job_alerts() = 1, 'alerta enviado com a vaga nova');
select test.check(public.queue_job_alerts() = 0, 'alerta diário não se repete no mesmo dia');
reset role;
select test.check(
  (select payload #>> '{jobs,0,title}' from public.notifications where template = 'job_alert') = 'Vendedor Interno'
  and (select jsonb_array_length(payload -> 'jobs') from public.notifications where template = 'job_alert') = 1,
  'e-mail do alerta traz só as vagas novas e compatíveis'
);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', false);
select test.check((select count(*) from public.job_alerts) = 0, 'cada pessoa vê só os próprios alertas');

-- ---------------------------------------------------------------------------
-- Relatórios da empresa
-- ---------------------------------------------------------------------------
reset role;
insert into public.job_views (job_id, source) select id, 'whatsapp' from v5 where title = 'Assistente PcD';
insert into public.job_views (job_id, source) select id, 'qrcode' from v5 where title = 'Assistente PcD';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select (j ->> 'views')::int = 2 and (j ->> 'applications')::int = 1 and (j #>> '{views_by_source,qrcode}')::int = 1
          and (j #>> '{funnel,interview}')::int = 1
   from jsonb_array_elements(public.company_report((select id from public.companies where trade_name = 'Loja Alfa'), 30) -> 'jobs') j
   where j ->> 'title' = 'Assistente PcD'),
  'relatório traz visualizações por origem, candidaturas e funil'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select test.expect_error(
  $$select public.company_report((select id from public.companies where trade_name = 'Loja Alfa'))$$,
  'sem acesso'
);

\echo
-- save_job e duplicate_job levam os campos novos
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
create temporary table vaga_conf as select * from public.save_job(null, (select id from public.companies where trade_name = 'Loja Alfa'),
  '{"title": "Diretor Sigiloso", "description": "Vaga de reposição sigilosa", "contract_type": "clt", "work_mode": "remote",
    "affirmative": "women", "is_confidential": true}'::jsonb);
create temporary table copia_conf as select public.duplicate_job((select job_id from vaga_conf)) as id;
select test.check(
  (select affirmative || '|' || is_confidential from public.jobs where id = (select job_id from vaga_conf)) = 'women|true'
  and (select affirmative || '|' || is_confidential from public.jobs where id = (select id from copia_conf)) = 'women|true',
  'salvar e duplicar vaga mantêm afirmativa e confidencial'
);
reset role;

\echo
