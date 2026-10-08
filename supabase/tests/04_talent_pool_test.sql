-- Testes da Fase 3: consentimento, busca por região e aderência, convites, favoritos e privacidade do contato.

\set ON_ERROR_STOP 1

reset role;

-- Candidatos do banco de talentos em volta de Belo Horizonte (3106200)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000301', 't1@test', '{"full_name": "Beatriz Alves Costa", "role": "candidate", "city_id": "3106200", "phone": "31911110001"}'),
  ('00000000-0000-0000-0000-000000000302', 't2@test', '{"full_name": "Caio Mendes", "role": "candidate", "city_id": "3106200"}'),
  ('00000000-0000-0000-0000-000000000303', 't3@test', '{"full_name": "Davi Rocha", "role": "candidate", "city_id": "3118601"}'),
  ('00000000-0000-0000-0000-000000000304', 't4@test', '{"full_name": "Elisa Prado", "role": "candidate", "city_id": "3136702"}'),
  ('00000000-0000-0000-0000-000000000305', 't5@test', '{"full_name": "Fábio Nunes", "role": "candidate", "city_id": "3550308"}'),
  ('00000000-0000-0000-0000-000000000306', 't6@test', '{"full_name": "Gabi Sem Cidade", "role": "candidate"}'),
  ('00000000-0000-0000-0000-000000000307', 't7@test', '{"full_name": "Heitor Fora do Banco", "role": "candidate", "city_id": "3106200"}'),
  ('00000000-0000-0000-0000-000000000308', 't8@test', '{"full_name": "Iara Pausada", "role": "candidate", "city_id": "3106200"}');

insert into public.resumes (profile_id, headline, objective, city_id, area_id, education_level, talent_pool_status, talent_pool_consent_version)
select p.id, x.headline, x.objective, p.city_id, (select id from public.areas where slug = x.area), x.edu::public.education_level, x.pool::public.talent_pool_status, '2026-10-11'
from (values
  ('00000000-0000-0000-0000-000000000301'::uuid, 'Vendedora experiente', 'Vendas e negociação no varejo', 'varejo', 'high_school', 'active'),
  ('00000000-0000-0000-0000-000000000302'::uuid, 'Auxiliar de loja', 'Primeiro emprego', 'administrativo', 'elementary', 'active'),
  ('00000000-0000-0000-0000-000000000303'::uuid, 'Vendedor', 'Vendas', 'varejo', 'high_school', 'active'),
  ('00000000-0000-0000-0000-000000000304'::uuid, 'Vendedora', 'Vendas', 'varejo', 'undergraduate', 'active'),
  ('00000000-0000-0000-0000-000000000305'::uuid, 'Vendedor', 'Vendas', 'varejo', 'high_school', 'active'),
  ('00000000-0000-0000-0000-000000000306'::uuid, 'Vendedora', 'Vendas', 'varejo', 'high_school', 'active'),
  ('00000000-0000-0000-0000-000000000307'::uuid, 'Vendedor', 'Vendas', 'varejo', 'high_school', 'none'),
  ('00000000-0000-0000-0000-000000000308'::uuid, 'Vendedora', 'Vendas', 'varejo', 'high_school', 'paused')
) as x(profile_id, headline, objective, area, edu, pool)
join public.profiles p on p.id = x.profile_id;

-- Habilidades: Beatriz tem tudo; Caio nada; os demais só "vendas"
insert into public.resume_skills (resume_id, skill_id)
select r.id, s.id from public.resumes r join public.skills s on s.slug in ('vendas', 'negociacao', 'excel-avancado')
where r.profile_id = '00000000-0000-0000-0000-000000000301'
union all
select r.id, s.id from public.resumes r join public.skills s on s.slug = 'vendas'
where r.profile_id in ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000304',
                       '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000306');

insert into public.resume_experiences (resume_id, company_name, role_title, started_on, is_current)
select id, 'Loja', 'Vendedora', current_date - interval '3 years', true from public.resumes
where profile_id = '00000000-0000-0000-0000-000000000301';

-- Vaga publicada da Loja Alfa em Belo Horizonte
insert into public.jobs (company_id, title, description, contract_type, work_mode, city_id, area_id, radius_km,
                         region_mode, min_education, min_experience_months, status)
select id, 'Vendedor Externo', 'Vendas externas', 'clt', 'on_site', 3106200, (select id from public.areas where slug = 'varejo'),
       30, 'prioritize', 'high_school', 12, 'published'
from public.companies where trade_name = 'Loja Alfa';
insert into public.job_skills (job_id, skill_id, requirement)
select j.id, s.id, case when s.slug = 'excel-avancado' then 'desired'::public.skill_requirement else 'required' end
from public.jobs j, public.skills s where j.title = 'Vendedor Externo' and s.slug in ('vendas', 'negociacao', 'excel-avancado');

create temporary table vaga3 as select id from public.jobs where title = 'Vendedor Externo';
create temporary table perfis as select r.id as resume_id, p.full_name from public.resumes r join public.profiles p on p.id = r.profile_id;
grant select on vaga3, perfis to authenticated;

-- ---------------------------------------------------------------------------
-- Quem pode buscar
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', false);
select test.expect_error($$select * from public.talent_search()$$, 'empresas com cadastro aprovado');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
select test.expect_error($$select * from public.talent_search()$$, 'empresas com cadastro aprovado');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select test.expect_error($$select * from public.talent_search((select id from vaga3))$$, 'não encontrada');

-- ---------------------------------------------------------------------------
-- Sugestão para a vaga: faixa de proximidade e aderência
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
create temporary table sugestao as
select row_number() over () as pos, t.* from public.talent_search((select id from vaga3), page_size => 50) t;

select test.check(
  (select array_agg(p.full_name order by s.pos) from sugestao s join perfis p on p.resume_id = s.resume_id
   where p.full_name in ('Beatriz Alves Costa', 'Caio Mendes', 'Davi Rocha', 'Elisa Prado', 'Fábio Nunes', 'Gabi Sem Cidade'))
    = array['Beatriz Alves Costa', 'Caio Mendes', 'Davi Rocha', 'Elisa Prado', 'Fábio Nunes', 'Gabi Sem Cidade'],
  'ordem: mesma cidade (por aderência), dentro do raio, mesmo estado, resto do país, sem cidade'
);
select test.check(
  (select array_agg(s.band order by s.pos) from sugestao s join perfis p on p.resume_id = s.resume_id
   where p.full_name in ('Beatriz Alves Costa', 'Caio Mendes', 'Davi Rocha', 'Elisa Prado', 'Fábio Nunes', 'Gabi Sem Cidade'))
    = array[1, 1, 2, 3, 4, 5]::smallint[],
  'faixas de proximidade calculadas'
);
select test.check(
  not exists (select 1 from sugestao s join perfis p on p.resume_id = s.resume_id where p.full_name in ('Heitor Fora do Banco', 'Iara Pausada')),
  'currículos fora do banco ou pausados não aparecem'
);
select test.check(
  (select score || '|' || matched_required || '/' || total_required || '|' || matched_desired || '/' || total_desired
   from sugestao s join perfis p on p.resume_id = s.resume_id where p.full_name = 'Beatriz Alves Costa') = '100|2/2|1/1',
  'aderência total para quem atende todos os critérios'
);
select test.check(
  (select score from sugestao s join perfis p on p.resume_id = s.resume_id where p.full_name = 'Caio Mendes') = 0,
  'aderência zero para quem não atende nenhum critério'
);
-- Davi: 1/2 exigidas (40*0,5=20), 0/1 desejável, área (20), 0 meses de 12 (0), escolaridade ok (10) => 50/100
select test.check(
  (select score from sugestao s join perfis p on p.resume_id = s.resume_id where p.full_name = 'Davi Rocha') = 50,
  'aderência ponderada pelos pesos de app_settings'
);
select test.check(
  (select display_name || '|' || distance_km from sugestao s join perfis p on p.resume_id = s.resume_id where p.full_name = 'Davi Rocha')
    like 'Davi R.|1%',
  'nome abreviado e distância em km'
);

-- Raio ajustado pela empresa: Juiz de Fora (≈214 km) entra na faixa "dentro do raio"
select test.check(
  (select t.band from public.talent_search((select id from vaga3), radius_km => 250, page_size => 50) t
   join perfis p on p.resume_id = t.resume_id where p.full_name = 'Elisa Prado') = 2,
  'raio ajustável pela empresa'
);

-- Pesos ajustáveis pelo admin
reset role;
update public.app_settings set value = '{"required_skills": 0, "desired_skills": 0, "area": 100, "experience": 0, "education": 0}' where key = 'matching_weights';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select t.score from public.talent_search((select id from vaga3), page_size => 50) t
   join perfis p on p.resume_id = t.resume_id where p.full_name = 'Davi Rocha') = 100,
  'pesos da aderência vêm da configuração do admin'
);
reset role;
update public.app_settings set value = '{"required_skills": 40, "desired_skills": 15, "area": 20, "experience": 15, "education": 10}' where key = 'matching_weights';

-- Modo restringir: só a região (mesma cidade e dentro do raio)
update public.jobs set region_mode = 'restrict' where id = (select id from vaga3);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select bool_and(t.band in (1, 2)) and count(*) = 3 from public.talent_search((select id from vaga3), page_size => 50) t
   join perfis p on p.resume_id = t.resume_id where p.full_name not like 'Carla%'),
  'modo restringir mostra só candidatos da região'
);
reset role;
update public.jobs set region_mode = 'prioritize' where id = (select id from vaga3);
update public.jobs set work_mode = 'remote', city_id = null where id = (select id from vaga3);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select bool_and(t.band = 0) from public.talent_search((select id from vaga3), page_size => 50) t),
  'vaga remota ignora a região'
);
reset role;
update public.jobs set work_mode = 'on_site', city_id = 3106200 where id = (select id from vaga3);

-- ---------------------------------------------------------------------------
-- Busca manual com filtros
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select count(*) from public.talent_search(center_city => 3106200, radius_km => 30, page_size => 50) t
   join perfis p on p.resume_id = t.resume_id where p.full_name in ('Beatriz Alves Costa', 'Caio Mendes', 'Davi Rocha', 'Elisa Prado')) = 3
  and (select score from public.talent_search(center_city => 3106200) limit 1) is null,
  'filtro por cidade e raio (sem vaga, sem aderência)'
);
select test.check(
  (select count(*) from public.talent_search(skill_ids => (select array_agg(id) from public.skills where slug in ('vendas', 'negociacao')), page_size => 50)) = 1,
  'filtro exige todas as habilidades escolhidas'
);
select test.check(
  (select array_agg(t.display_name) from public.talent_search(min_education => 'undergraduate') t) = array['Elisa P.'],
  'filtro por escolaridade mínima'
);
select test.check(
  (select array_agg(t.display_name) from public.talent_search(min_experience_months => 24) t) = array['Beatriz C.'],
  'filtro por experiência mínima'
);
select test.check(
  (select count(*) from public.talent_search(query => 'negociação') t) = 1,
  'busca por texto ignora acentos'
);
select test.check(
  (select total_count from public.talent_search(page_size => 2) limit 1) >= 6
  and (select count(*) from public.talent_search(page_size => 2)) = 2,
  'paginação com total'
);

-- ---------------------------------------------------------------------------
-- Privacidade do contato no banco de talentos
-- ---------------------------------------------------------------------------
create temporary table beatriz as select resume_id from perfis where full_name = 'Beatriz Alves Costa';
reset role;
grant select on beatriz to authenticated;
insert into storage.objects (bucket_id, name) values ('resumes', '00000000-0000-0000-0000-000000000301/cv.pdf');
update public.resumes set pdf_path = '00000000-0000-0000-0000-000000000301/cv.pdf' where id = (select resume_id from beatriz);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select display_name || '|' || contact_released from public.talent_identity((select resume_id from beatriz))) = 'Beatriz C.|false',
  'perfil do banco mostra nome abreviado antes do aceite'
);
select test.check(
  (select count(*) from storage.objects where name like '00000000-0000-0000-0000-000000000301/%') = 0
  and (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000301') = 0,
  'PDF e contato ficam ocultos antes do aceite'
);
select test.check(
  (select count(*) from public.resume_experiences where resume_id = (select resume_id from beatriz)) = 1,
  'perfil profissional estruturado fica visível'
);

-- Favoritos
insert into public.saved_resumes (company_id, resume_id, list_name)
select c.id, (select resume_id from beatriz), '  Vendas BH  ' from public.companies c where trade_name = 'Loja Alfa';
select test.check(
  (select list_name || '|' || saved_by from public.saved_resumes where resume_id = (select resume_id from beatriz))
    = 'Vendas BH|00000000-0000-0000-0000-000000000102',
  'favorito registra lista e quem salvou'
);
select test.check(
  (select saved from public.talent_search((select id from vaga3), page_size => 50) where resume_id = (select resume_id from beatriz)),
  'busca indica currículos salvos'
);

-- ---------------------------------------------------------------------------
-- Convite e aceite
-- ---------------------------------------------------------------------------
insert into public.talent_invites (job_id, resume_id, message)
values ((select id from vaga3), (select resume_id from beatriz), 'Seu perfil combina com a vaga!');
select test.expect_error(
  $$insert into public.talent_invites (job_id, resume_id) select (select id from vaga3), resume_id from perfis where full_name = 'Heitor Fora do Banco'$$
);
select test.check(
  (select invite_status from public.talent_search((select id from vaga3), page_size => 50) where resume_id = (select resume_id from beatriz)) = 'pending',
  'busca indica convite pendente'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', false);
select test.check(
  (select payload ->> 'message' from public.notifications where template = 'talent_invite') = 'Seu perfil combina com a vaga!',
  'candidata recebe o convite por e-mail'
);
-- Aceite pelo fluxo de candidatura (com consentimento), sem perguntas nesta vaga
select public.apply_to_job((select id from vaga3), '[]'::jsonb, null, '2026-10-10');
select test.check(
  (select status from public.talent_invites where resume_id = (select resume_id from beatriz)) = 'accepted'
  and (select source from public.applications where resume_id = (select resume_id from beatriz) and job_id = (select id from vaga3)) = 'invite',
  'candidatar-se aceita o convite e a origem fica "convite"'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select display_name || '|' || contact_released from public.talent_identity((select resume_id from beatriz))) = 'Beatriz Alves Costa|true'
  and (select phone from public.profiles where id = '00000000-0000-0000-0000-000000000301') = '31911110001'
  and (select count(*) from storage.objects where name like '00000000-0000-0000-0000-000000000301/%') = 1,
  'após o aceite a empresa vê nome, telefone e PDF'
);
select test.expect_error(
  $$insert into public.talent_invites (job_id, resume_id) values ((select id from vaga3), (select resume_id from perfis where full_name = 'Beatriz Alves Costa'))$$
);

-- Outra empresa aprovada continua vendo só o perfil abreviado
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select test.check(
  (select contact_released from public.talent_identity((select resume_id from beatriz))) = false
  and (select count(*) from public.saved_resumes) = 0,
  'liberação de contato e favoritos valem só para a empresa envolvida'
);

-- ---------------------------------------------------------------------------
-- Consentimento: participar, pausar e retirar
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000307', false);
select test.expect_error($$select public.set_talent_pool('active')$$, 'aceitar o termo');
select public.set_talent_pool('active', '2026-10-11');
select test.check(
  (select talent_pool_status || '|' || talent_pool_consent_version from public.resumes) = 'active|2026-10-11'
  and (select talent_pool_consent_at from public.resumes) is not null,
  'autorização registra versão e data'
);
select public.set_talent_pool('paused');
select public.set_talent_pool('active');
select public.set_talent_pool('none');
select test.check(
  (select array_agg(granted order by created_at) from public.consents where purpose = 'talent_pool') = array[true, false],
  'histórico registra autorização e retirada (pausa não altera o consentimento)'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  not exists (select 1 from public.talent_search(page_size => 100) t join perfis p on p.resume_id = t.resume_id where p.full_name = 'Heitor Fora do Banco'),
  'quem retira o currículo sai da busca'
);

-- Exclusão da conta remove os dados do candidato em cascata
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000307';
select test.check(
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000307')
  and not exists (select 1 from public.resumes r join perfis p on p.resume_id = r.id where p.full_name = 'Heitor Fora do Banco')
  and not exists (select 1 from public.consents where profile_id = '00000000-0000-0000-0000-000000000307'),
  'excluir a conta apaga perfil, currículo e consentimentos'
);

\echo
