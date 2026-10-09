-- Testes da Fase 4: busca pública, métricas, tempo de moderação, catálogos, limite de requisições e retenção.

\set ON_ERROR_STOP 1

reset role;

-- Vagas publicadas para a busca (Loja Alfa, aprovada)
insert into public.jobs (company_id, title, description, contract_type, work_mode, city_id, status, published_at)
select c.id, x.title, x.description, x.contract::public.contract_type, x.mode::public.work_mode, x.city, 'published', now() - x.age
from public.companies c,
  (values
    ('Garçom', 'Atendimento em restaurante', 'clt', 'on_site', 3118601, interval '1 day'),
    ('Programador Júnior', 'Desenvolvimento web com JavaScript', 'pj', 'remote', null::integer, interval '2 days'),
    ('Cozinheiro', 'Cozinha industrial', 'temporary', 'on_site', 3550308, interval '3 days'),
    ('Recepcionista', 'Atendimento e agenda', 'clt', 'hybrid', 3106200, interval '4 days')
  ) as x(title, description, contract, mode, city, age)
where c.trade_name = 'Loja Alfa';

-- ---------------------------------------------------------------------------
-- Busca pública
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select test.check(
  (select count(*) from public.search_jobs(page_size => 50) where title in ('Garçom', 'Programador Júnior', 'Cozinheiro', 'Recepcionista')) = 4
  and not exists (select 1 from public.search_jobs(page_size => 50) where title like '%(cópia)'),
  'visitante encontra só vagas publicadas'
);
select test.check(
  (select array_agg(title order by ord) from (
     select title, row_number() over () as ord
     from public.search_jobs(center_city => 3106200, radius_km => 30, page_size => 50)
     where title in ('Garçom', 'Programador Júnior', 'Cozinheiro', 'Recepcionista')
   ) t) = array['Recepcionista', 'Garçom', 'Programador Júnior'],
  'com cidade: dentro do raio por distância e depois as remotas; fora do raio fica de fora'
);
select test.check(
  (select count(*) from public.search_jobs(center_city => 3106200, radius_km => 600, page_size => 50) where title = 'Cozinheiro') = 1,
  'raio ajustável pelo candidato'
);
select test.check(
  (select array_agg(title) from public.search_jobs(query => 'javascript')) = array['Programador Júnior']
  and (select count(*) from public.search_jobs(query => 'garcom')) = 1,
  'busca por texto sem acentos'
);
select test.check(
  (select bool_and(work_mode = 'remote') from public.search_jobs(mode => 'remote'))
  and (select bool_and(contract_type = 'temporary') from public.search_jobs(contract => 'temporary')),
  'filtros por modalidade e contrato'
);
select test.check(
  (select distance_km from public.search_jobs(center_city => 3106200, page_size => 50) where title = 'Garçom') between 10 and 20,
  'distância em km no resultado'
);

-- ---------------------------------------------------------------------------
-- Denúncia: só pelo servidor (service_role), com limite de requisições
-- ---------------------------------------------------------------------------
select test.expect_error($$select public.hit_rate_limit('x', 1, 60)$$, 'permission denied');

reset role;
set role service_role;
select test.check(
  public.hit_rate_limit('report:1.2.3.4', 2, 3600) and public.hit_rate_limit('report:1.2.3.4', 2, 3600)
  and not public.hit_rate_limit('report:1.2.3.4', 2, 3600)
  and public.hit_rate_limit('report:5.6.7.8', 2, 3600),
  'limite de requisições por chave'
);
insert into public.job_reports (job_id, reason, details)
select id, 'Cobrança de taxa', 'Pediram pagamento para a entrevista' from public.jobs where title = 'Garçom';
reset role;
select test.check(
  (select count(*) from public.notifications where template = 'job_reported') >= 1,
  'administradores recebem aviso de denúncia'
);

-- ---------------------------------------------------------------------------
-- Tempo de moderação e métricas
-- ---------------------------------------------------------------------------
update public.jobs set status = 'in_review' where title = 'Cozinheiro';
update public.jobs set submitted_at = now() - interval '5 hours' where title = 'Cozinheiro';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.job_moderation (job_id, decision) select id, 'approved' from public.jobs where title = 'Cozinheiro';
select test.check(
  (select wait_seconds from public.job_moderation where job_id = (select id from public.jobs where title = 'Cozinheiro')) between 17990 and 18100,
  'decisão guarda o tempo de espera da análise'
);
select test.check(
  (public.admin_metrics() ->> 'jobs_published')::int >= 4
  and (public.admin_metrics() ->> 'reports_open')::int >= 1
  and (public.admin_metrics() ->> 'avg_moderation_hours_30d') is not null,
  'métricas gerais para o administrador'
);

-- Catálogo: endereço amigável automático
insert into public.areas (name) values ('  Hotelaria e turismo ');
insert into public.skills (name) values ('Atendimento em restaurante');
select test.check(
  (select slug from public.areas where name = 'Hotelaria e turismo') = 'hotelaria-e-turismo'
  and (select slug from public.skills where name = 'Atendimento em restaurante') = 'atendimento-em-restaurante',
  'catálogos geram o endereço amigável'
);
update public.app_settings set value = '30' where key = 'default_radius_km';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.expect_error($$select public.admin_metrics()$$, 'apenas administradores');
select test.expect_error($$insert into public.areas (name) values ('Invasão')$$, 'row-level security');

-- ---------------------------------------------------------------------------
-- Retenção de candidatos inativos
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000401', 'inativo5@test', '{"full_name": "Inativo Cinco", "role": "candidate"}'),
  ('00000000-0000-0000-0000-000000000402', 'inativo7@test', '{"full_name": "Inativo Sete", "role": "candidate"}'),
  ('00000000-0000-0000-0000-000000000403', 'ativo@test', '{"full_name": "Ativo", "role": "candidate"}');
update public.profiles set last_active_at = now() - interval '5 months 3 days' where id = '00000000-0000-0000-0000-000000000401';
update public.profiles set last_active_at = now() - interval '7 months', inactivity_warned_at = now() - interval '30 days'
where id = '00000000-0000-0000-0000-000000000402';

set role service_role;
create temporary table retencao as select * from public.retention_candidates();
select test.check(
  (select action from retencao where profile_id = '00000000-0000-0000-0000-000000000401') = 'warn'
  and (select action from retencao where profile_id = '00000000-0000-0000-0000-000000000402') = 'delete'
  and not exists (select 1 from retencao where profile_id = '00000000-0000-0000-0000-000000000403'),
  'aviso no 5º mês e remoção após 6 meses com aviso prévio'
);
select test.check(
  public.mark_inactivity_warned(array['00000000-0000-0000-0000-000000000401'::uuid]) = 1
  and public.mark_inactivity_warned(array['00000000-0000-0000-0000-000000000401'::uuid]) = 0,
  'aviso de inatividade enviado uma vez'
);
select test.check(
  not exists (select 1 from public.retention_candidates() where profile_id = '00000000-0000-0000-0000-000000000401'),
  'recém-avisado aguarda o prazo antes da remoção'
);

-- Voltar a usar o portal cancela o aviso
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', false);
select public.touch_last_active();
reset role;
select test.check(
  (select inactivity_warned_at is null and last_active_at > now() - interval '1 minute' from public.profiles where id = '00000000-0000-0000-0000-000000000401'),
  'atividade do candidato cancela o aviso de inatividade'
);
select test.check(
  (select count(*) from public.notifications where template = 'inactivity_warning') = 1,
  'e-mail de aviso de inatividade enfileirado'
);

\echo
-- ---------------------------------------------------------------------------
-- Avisos: uma denúncia aberta por vaga gera um único e-mail; retirada informa que a vaga estava no ar
-- ---------------------------------------------------------------------------
reset role;
delete from public.notifications;
set role service_role;
insert into public.job_reports (job_id, reason) select id, 'Vaga falsa ou golpe' from public.jobs where title = 'Garçom';
insert into public.job_reports (job_id, reason) select id, 'Vaga falsa ou golpe' from public.jobs where title = 'Garçom';
reset role;
select test.check(
  (select count(*) from public.notifications where template = 'job_reported') = 0,
  'novas denúncias de vaga com denúncia aberta não repetem o aviso'
);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.job_moderation (job_id, decision, reason) select id, 'rejected', 'Cobrança de taxa' from public.jobs where title = 'Garçom';
reset role;
select test.check(
  (select (payload ->> 'was_published')::boolean from public.notifications where template = 'job_moderated'),
  'aviso de retirada informa que a vaga estava publicada'
);

\echo
