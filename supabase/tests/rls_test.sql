-- Testes de RLS e regras de negócio. Executado por scripts/test-db.sh após as migrações.
-- Cada bloco troca a identidade (papel + auth.uid()) e verifica o que pode ou não ser feito.

\set ON_ERROR_STOP 1

create schema test;
grant usage on schema test to anon, authenticated;

create function test.expect_error(statement text, expected text default null) returns void
language plpgsql as $$
begin
  execute statement;
  raise exception 'FALHOU: era esperado erro em: %', statement;
exception when others then
  if sqlerrm like 'FALHOU:%' then raise; end if;
  if expected is not null and sqlerrm not ilike '%' || expected || '%' then
    raise exception 'FALHOU: erro inesperado em "%": %', statement, sqlerrm;
  end if;
end;
$$;

create function test.check(condition boolean, message text) returns void
language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FALHOU: %', message;
  end if;
  raise notice 'ok: %', message;
end;
$$;

create function test.job_id(job_title text) returns uuid
language sql security definer set search_path = '' as $$
  select id from public.jobs where title = job_title;
$$;

grant execute on all functions in schema test to anon, authenticated;

-- Usuários de teste (o gatilho cria os perfis)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@trivagas.test', '{"full_name": "Admin", "role": "admin"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'ana@test', '{"full_name": "Ana Candidata", "role": "candidate", "city_id": "3550308", "phone": "(11) 98888-7777"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'bruno@test', '{"full_name": "Bruno Candidato", "city_id": "3509502"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'rh@empresa1.test', '{"full_name": "RH Empresa 1", "role": "company"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'rh@empresa2.test', '{"full_name": "RH Empresa 2", "role": "company", "terms_version": "2026-10-08"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'google@test', '{"name": "Fulano Google"}');

select test.check(
  (select count(*) from public.consents where profile_id = '00000000-0000-0000-0000-0000000000e2') = 2,
  'aceite dos termos no cadastro fica registrado'
);
select test.check(
  (select onboarded_at from public.profiles where id = '00000000-0000-0000-0000-0000000000f1') is null,
  'entrada sem perfil escolhido fica pendente de boas-vindas'
);

select test.check(
  (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'candidate',
  'cadastro não consegue se autopromover a admin'
);
select test.check(
  (select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = '11988887777'
  and (select city_id from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 3550308,
  'perfil recebe telefone normalizado e cidade do cadastro'
);

-- Boas-vindas de quem entrou pelo Google
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select test.expect_error($$select public.complete_onboarding('admin', 'X', null, null, 'v1', 'v1')$$, 'perfil inválido');
select public.complete_onboarding('company', 'Fulano', 3304557, '21 99999-0000', '2026-10-08', '2026-10-08');
select test.check(
  (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000f1') = 'company',
  'boas-vindas define o perfil escolhido'
);
select test.expect_error($$select public.complete_onboarding('candidate', 'X', null, null, 'v1', 'v1')$$, 'já concluído');
reset role;

-- Promoção a admin é feita por SQL com papel privilegiado
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- Busca de cidades e distância
select test.check(
  (select name from public.search_cities('sao paulo') limit 1) = 'São Paulo',
  'busca de cidade ignora acentos e prioriza nome exato'
);
select test.check(
  public.city_distance_km(3550308, 3509502) between 75 and 95,
  'distância São Paulo–Campinas em torno de 84 km'
);

-- ---------------------------------------------------------------------------
-- Empresa 1 se cadastra
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);

insert into public.companies (cnpj, legal_name, trade_name, city_id, status)
values ('11222333000181', 'Empresa Um LTDA', 'Empresa Um', 3550308, 'approved');

select test.check(
  (select status from public.companies where cnpj = '11222333000181') = 'pending',
  'empresa nova sempre começa pendente'
);
select test.check(
  (select slug from public.companies where cnpj = '11222333000181') ~ '^empresa-um-[a-f0-9]{4}$',
  'empresa recebe endereço amigável'
);
select test.check(
  exists (select 1 from public.company_members m join public.companies c on c.id = m.company_id
          where c.cnpj = '11222333000181' and m.role = 'admin'),
  'criador vira administrador da empresa'
);
select test.expect_error(
  $$update public.companies set status = 'approved' where cnpj = '11222333000181'$$,
  'administrador'
);

insert into public.jobs (company_id, title, description, city_id, status)
select id, 'Auxiliar Administrativo', 'Rotinas de escritório', 3550308, 'draft'
from public.companies where cnpj = '11222333000181';

select test.check(
  (select slug from public.jobs where title = 'Auxiliar Administrativo') ~ '^auxiliar-administrativo-[a-f0-9]{4}$',
  'vaga recebe endereço amigável'
);
select test.expect_error(
  $$update public.jobs set status = 'published' where title = 'Auxiliar Administrativo'$$,
  'transição'
);
select test.expect_error(
  $$insert into public.jobs (company_id, title, work_mode) select id, 'Sem cidade', 'on_site' from public.companies where cnpj = '11222333000181'$$,
  'jobs_city_required'
);
update public.jobs set status = 'in_review' where title = 'Auxiliar Administrativo';

insert into public.jobs (company_id, title, work_mode, status)
select id, 'Desenvolvedor Remoto', 'remote', 'draft' from public.companies where cnpj = '11222333000181';

-- ---------------------------------------------------------------------------
-- Candidata tenta cadastrar empresa e alterar o próprio papel
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test.expect_error(
  $$insert into public.companies (cnpj, legal_name, trade_name) values ('99888777000166', 'X', 'Xx')$$
);
select test.expect_error(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'papel'
);
select test.check(
  (select count(*) from public.jobs) = 0,
  'candidata não vê vagas em análise ou rascunho'
);

-- ---------------------------------------------------------------------------
-- Admin aprova empresa e vaga
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.companies set status = 'approved' where cnpj = '11222333000181';
select test.check(
  (select reviewed_by from public.companies where cnpj = '11222333000181') = '00000000-0000-0000-0000-00000000000a',
  'aprovação registra o moderador'
);
select test.expect_error(
  $$insert into public.job_moderation (job_id, decision) select id, 'rejected' from public.jobs where title = 'Auxiliar Administrativo'$$,
  'job_moderation_reason_required'
);
insert into public.job_moderation (job_id, decision)
select id, 'approved' from public.jobs where title = 'Auxiliar Administrativo';
select test.check(
  (select status from public.jobs where title = 'Auxiliar Administrativo') = 'published'
  and (select published_at from public.jobs where title = 'Auxiliar Administrativo') is not null,
  'aprovação na moderação publica a vaga'
);

-- ---------------------------------------------------------------------------
-- Visitante
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select test.check((select count(*) from public.jobs) = 1, 'visitante vê apenas a vaga publicada');
select test.check((select count(*) from public.companies) = 1, 'visitante vê empresa aprovada');
select public.register_job_view((select id from public.jobs limit 1), 'whatsapp', null);
insert into public.job_reports (job_id, reason) select id, 'Parece golpe' from public.jobs limit 1;
select test.check((select count(*) from public.job_reports) = 0, 'visitante não lê denúncias');
select test.expect_error($$insert into public.job_views (job_id) select id from public.jobs limit 1$$);
select test.expect_error($$select public.close_expired_jobs()$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Empresa 1 edita campo sensível de vaga publicada
-- ---------------------------------------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select test.check((select count(*) from public.job_views) = 1, 'empresa vê visualizações da própria vaga');
update public.jobs set positions = 3 where title = 'Auxiliar Administrativo';
select test.check(
  (select status from public.jobs where title = 'Auxiliar Administrativo') = 'published',
  'edição de campo não sensível mantém a vaga publicada'
);
update public.jobs set title = 'Auxiliar Administrativo Pleno' where title = 'Auxiliar Administrativo';
select test.check(
  (select status from public.jobs where title = 'Auxiliar Administrativo Pleno') = 'in_review',
  'edição do título devolve a vaga para análise'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.job_moderation (job_id, decision)
select id, 'approved' from public.jobs where title = 'Auxiliar Administrativo Pleno';

-- ---------------------------------------------------------------------------
-- Empresa 2 (pendente) não enxerga nada da empresa 1
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
insert into public.companies (cnpj, legal_name, trade_name, city_id)
values ('44555666000199', 'Empresa Dois SA', 'Empresa Dois', 3509502);
select test.check(
  (select count(*) from public.jobs) = 1,
  'empresa 2 vê só a vaga publicada da empresa 1, sem o rascunho'
);
update public.jobs set title = 'Invadido' where title = 'Auxiliar Administrativo Pleno';
select test.check(
  not exists (select 1 from public.jobs where title = 'Invadido'),
  'empresa 2 não edita vaga da empresa 1'
);
select test.check((select count(*) from public.job_views) = 0, 'empresa 2 não vê visualizações da empresa 1');
insert into public.jobs (company_id, title, city_id, status)
select id, 'Vendedor', 3509502, 'in_review' from public.companies where cnpj = '44555666000199';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select test.expect_error(
  $$insert into public.job_moderation (job_id, decision) select id, 'approved' from public.jobs where title = 'Vendedor'$$,
  'aprovada'
);

-- ---------------------------------------------------------------------------
-- Candidata: currículo, banco de talentos e candidatura
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
insert into public.resumes (profile_id, headline, city_id)
values ('00000000-0000-0000-0000-0000000000e1', 'Assistente administrativa', 3550308);
select test.check(
  (select profile_id from public.resumes) = '00000000-0000-0000-0000-0000000000c1',
  'currículo sempre pertence a quem o cria'
);
select test.expect_error(
  $$update public.resumes set talent_pool_status = 'active'$$,
  'versão do termo'
);
update public.resumes set talent_pool_status = 'active', talent_pool_consent_version = '2026-10-08';
select test.check(
  (select talent_pool_consent_at from public.resumes) is not null,
  'consentimento do banco de talentos registra a data'
);
insert into public.consents (profile_id, purpose, granted, term_version)
values ('00000000-0000-0000-0000-0000000000e1', 'talent_pool', true, '2026-10-08');
select test.check(
  (select profile_id from public.consents) = '00000000-0000-0000-0000-0000000000c1',
  'consentimento sempre registrado para o próprio titular'
);

insert into public.applications (job_id, resume_id, stage)
select j.id, r.id, 'approved' from public.jobs j, public.resumes r where j.title = 'Auxiliar Administrativo Pleno';
select test.check(
  (select stage from public.applications) = 'new',
  'candidatura sempre começa como nova'
);
update public.applications set stage = 'approved';
select test.check(
  (select stage from public.applications) = 'new',
  'candidata não altera a etapa do funil'
);
select test.expect_error(
  $$insert into public.applications (job_id, resume_id) select test.job_id('Desenvolvedor Remoto'), r.id from public.resumes r$$,
  'não está recebendo'
);

insert into storage.objects (bucket_id, name) values ('resumes', '00000000-0000-0000-0000-0000000000c1/cv.pdf');
select test.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('resumes', '00000000-0000-0000-0000-0000000000c2/cv.pdf')$$
);
update public.resumes set pdf_path = '00000000-0000-0000-0000-0000000000c1/cv.pdf';

-- ---------------------------------------------------------------------------
-- Empresa 1 avalia a candidatura
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
update public.applications set stage = 'interview', rating = 4;
select test.check(
  (select stage from public.applications) = 'interview',
  'empresa move candidato no funil'
);
select test.expect_error($$update public.applications set source = 'invite'$$, 'origem');
insert into public.application_notes (application_id, body) select id, 'Boa comunicação' from public.applications;
select test.check(
  (select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = '11988887777',
  'empresa vê contato de quem se candidatou'
);
select test.check(
  (select count(*) from storage.objects where bucket_id = 'resumes') = 1,
  'empresa acessa o PDF de quem se candidatou'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test.check((select count(*) from public.application_notes) = 0, 'candidata não vê anotações internas');

-- ---------------------------------------------------------------------------
-- Banco de talentos: empresa 2 aprovada busca e convida
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select test.check((select count(*) from public.resumes) = 0, 'empresa pendente não acessa o banco de talentos');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.companies set status = 'approved' where cnpj = '44555666000199';
insert into public.job_moderation (job_id, decision) select id, 'approved' from public.jobs where title = 'Vendedor';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.resumes (profile_id, headline, city_id) values ('00000000-0000-0000-0000-0000000000c2', 'Vendedor', 3509502);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select test.check(
  (select count(*) from public.resumes) = 1
  and (select headline from public.resumes) = 'Assistente administrativa',
  'empresa aprovada vê só currículos autorizados no banco'
);
select test.check(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 0,
  'contato do banco de talentos fica oculto até o aceite'
);
select test.check(
  (select count(*) from storage.objects where bucket_id = 'resumes') = 1,
  'PDF de currículo autorizado no banco pode ser aberto pela empresa aprovada'
);
select test.check((select count(*) from public.applications) = 0, 'empresa 2 não vê candidaturas da empresa 1');
select test.expect_error(
  $$insert into public.talent_invites (job_id, resume_id) select j.id, 'ffffffff-0000-0000-0000-000000000000'::uuid from public.jobs j where j.title = 'Vendedor'$$
);
insert into public.talent_invites (job_id, resume_id, message)
select j.id, r.id, 'Venha conversar' from public.jobs j, public.resumes r where j.title = 'Vendedor';
insert into public.saved_resumes (company_id, resume_id)
select c.id, r.id from public.companies c, public.resumes r where c.cnpj = '44555666000199';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select test.check((select count(*) from public.talent_invites) = 1, 'candidata vê o convite');
select test.check(
  (select count(*) from public.jobs where title = 'Vendedor') = 1,
  'candidata vê a vaga do convite'
);
update public.talent_invites set status = 'accepted';
select test.expect_error($$update public.talent_invites set status = 'declined'$$, 'respondido');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select test.check(
  (select source from public.applications) = 'invite',
  'convite aceito vira candidatura com origem convite'
);
select test.check(
  (select phone from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = '11988887777',
  'contato liberado após aceite do convite'
);

-- Candidata retira o currículo do banco: empresa 2 continua vendo por causa da candidatura,
-- mas uma terceira empresa não veria mais.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
update public.resumes set talent_pool_status = 'paused';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select test.check((select count(*) from public.resumes) = 1, 'candidatura mantém acesso ao currículo');

-- ---------------------------------------------------------------------------
-- Encerramento automático
-- ---------------------------------------------------------------------------
reset role;
update public.jobs set closes_at = current_date - 1 where title = 'Vendedor';
select test.check(public.close_expired_jobs() = 1, 'vagas vencidas são encerradas');
select test.check(
  (select status from public.jobs where title = 'Vendedor') = 'closed'
  and (select closed_at from public.jobs where title = 'Vendedor') is not null,
  'vaga encerrada registra a data'
);

\echo
