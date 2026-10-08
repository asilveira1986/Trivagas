-- Trivagas · Fase 0 · Tabelas centrais: perfis, empresas, vagas, currículos e candidaturas

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'candidate',
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,13}$'),
  city_id integer references public.cities (id),
  onboarded_at timestamptz,             -- null até o usuário escolher o perfil (ex.: entrada pelo Google)
  blocked_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_city_id_idx on public.profiles (city_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil quando o usuário se cadastra no Supabase Auth.
-- O papel vem dos metadados do cadastro, mas nunca pode ser "admin".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role text := meta ->> 'role';
  requested_city integer;
  requested_phone text := nullif(regexp_replace(coalesce(meta ->> 'phone', ''), '[^0-9+]', '', 'g'), '');
begin
  begin
    requested_city := nullif(meta ->> 'city_id', '')::integer;
  exception when others then
    requested_city := null;
  end;

  if requested_city is not null and not exists (select 1 from public.cities where id = requested_city) then
    requested_city := null;
  end if;

  if requested_phone is not null and requested_phone !~ '^\+?[0-9]{10,13}$' then
    requested_phone := null;
  end if;

  insert into public.profiles (id, role, full_name, email, phone, city_id, onboarded_at)
  values (
    new.id,
    case when requested_role = 'company' then 'company'::public.user_role else 'candidate'::public.user_role end,
    left(coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), ''), 120),
    new.email,
    requested_phone,
    requested_city,
    case when requested_role in ('candidate', 'company') then now() end
  );

  -- Aceite dos termos feito no formulário de cadastro.
  if nullif(meta ->> 'terms_version', '') is not null then
    insert into public.consents (profile_id, purpose, granted, term_version)
    values
      (new.id, 'terms_of_use', true, left(meta ->> 'terms_version', 40)),
      (new.id, 'privacy_policy', true, left(coalesce(nullif(meta ->> 'privacy_version', ''), meta ->> 'terms_version'), 40));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do perfil sincronizado com o Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cnpj char(14) not null unique check (cnpj ~ '^[0-9]{14}$'),
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  trade_name text not null check (char_length(trade_name) between 2 and 120),
  segment text,
  size public.company_size,
  postal_code char(8) check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  street text,
  street_number text,
  complement text,
  district text,
  city_id integer references public.cities (id),
  phone text,
  email text,
  website text,
  logo_path text,
  description text check (description is null or char_length(description) <= 5000),
  status public.company_status not null default 'pending',
  status_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_status_idx on public.companies (status);
create index companies_city_id_idx on public.companies (city_id);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.company_member_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);

create index company_members_profile_id_idx on public.company_members (profile_id);

-- ---------------------------------------------------------------------------
-- Vagas
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 20000),
  area_id uuid references public.areas (id) on delete set null,
  contract_type public.contract_type not null default 'clt',
  work_mode public.work_mode not null default 'on_site',
  city_id integer references public.cities (id),
  salary_min numeric(12, 2) check (salary_min is null or salary_min >= 0),
  salary_max numeric(12, 2) check (salary_max is null or salary_max >= 0),
  benefits text[] not null default '{}',
  positions integer not null default 1 check (positions between 1 and 1000),
  closes_at date,
  status public.job_status not null default 'draft',
  region_mode public.region_mode not null default 'prioritize',
  radius_km integer not null default 30 check (radius_km between 0 and 1000),
  min_education public.education_level,
  min_experience_months integer check (min_experience_months is null or min_experience_months >= 0),
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.immutable_unaccent(coalesce(description, ''))), 'B')
  ) stored,
  constraint jobs_salary_range check (salary_min is null or salary_max is null or salary_min <= salary_max),
  -- Vaga presencial ou híbrida exige cidade.
  constraint jobs_city_required check (work_mode = 'remote' or city_id is not null)
);

create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_status_idx on public.jobs (status);
create index jobs_city_id_idx on public.jobs (city_id);
create index jobs_area_id_idx on public.jobs (area_id);
create index jobs_closes_at_idx on public.jobs (closes_at) where status in ('published', 'paused');
create index jobs_search_vector_idx on public.jobs using gin (search_vector);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_skills (
  job_id uuid not null references public.jobs (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  requirement public.skill_requirement not null default 'required',
  primary key (job_id, skill_id)
);

create index job_skills_skill_id_idx on public.job_skills (skill_id);

create table public.job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  position smallint not null default 0,
  question text not null check (char_length(question) between 3 and 300),
  type public.question_type not null default 'yes_no',
  options text[] not null default '{}',
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create index job_questions_job_id_idx on public.job_questions (job_id, position);

-- ---------------------------------------------------------------------------
-- Currículos
-- ---------------------------------------------------------------------------
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 120),
  objective text check (objective is null or char_length(objective) <= 2000),
  city_id integer references public.cities (id),
  area_id uuid references public.areas (id) on delete set null,
  education_level public.education_level,
  desired_salary numeric(12, 2) check (desired_salary is null or desired_salary >= 0),
  languages jsonb not null default '[]'::jsonb,   -- [{"language": "Inglês", "level": "intermediate"}]
  pdf_path text,
  search_radius_km integer not null default 30 check (search_radius_km between 0 and 1000),
  talent_pool_status public.talent_pool_status not null default 'none',
  talent_pool_consent_at timestamptz,
  talent_pool_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resumes_city_id_idx on public.resumes (city_id);
create index resumes_area_id_idx on public.resumes (area_id);
create index resumes_talent_pool_idx on public.resumes (talent_pool_status) where talent_pool_status = 'active';

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

create table public.resume_experiences (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  company_name text not null,
  role_title text not null,
  started_on date not null,
  ended_on date,
  is_current boolean not null default false,
  activities text check (activities is null or char_length(activities) <= 3000),
  created_at timestamptz not null default now(),
  constraint resume_experiences_period check (ended_on is null or ended_on >= started_on)
);

create index resume_experiences_resume_id_idx on public.resume_experiences (resume_id);

create table public.resume_education (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  course text not null,
  institution text not null,
  level public.education_level not null,
  is_course boolean not null default false,  -- curso livre/complementar
  started_on date,
  ended_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint resume_education_period check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index resume_education_resume_id_idx on public.resume_education (resume_id);

create table public.resume_skills (
  resume_id uuid not null references public.resumes (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level public.skill_level not null default 'intermediate',
  primary key (resume_id, skill_id)
);

create index resume_skills_skill_id_idx on public.resume_skills (skill_id);

-- ---------------------------------------------------------------------------
-- Candidaturas
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  stage public.application_stage not null default 'new',
  rating smallint check (rating is null or rating between 1 and 5),
  source public.application_source not null default 'link',
  source_detail text,                                   -- ex.: whatsapp, linkedin, qrcode
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, resume_id)
);

create index applications_resume_id_idx on public.applications (resume_id);
create index applications_job_stage_idx on public.applications (job_id, stage);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create table public.application_answers (
  application_id uuid not null references public.applications (id) on delete cascade,
  question_id uuid not null references public.job_questions (id) on delete cascade,
  answer text not null check (char_length(answer) <= 2000),
  primary key (application_id, question_id)
);

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index application_notes_application_id_idx on public.application_notes (application_id);

-- ---------------------------------------------------------------------------
-- Banco de talentos
-- ---------------------------------------------------------------------------
create table public.talent_invites (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  message text check (message is null or char_length(message) <= 1000),
  status public.invite_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, resume_id)
);

create index talent_invites_resume_id_idx on public.talent_invites (resume_id);

create table public.saved_resumes (
  company_id uuid not null references public.companies (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  list_name text not null default 'Favoritos' check (char_length(list_name) between 1 and 60),
  saved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, resume_id, list_name)
);

create index saved_resumes_resume_id_idx on public.saved_resumes (resume_id);

-- ---------------------------------------------------------------------------
-- Moderação, denúncias e visualizações
-- ---------------------------------------------------------------------------
create table public.job_moderation (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  decision public.moderation_decision not null,
  reason text,
  moderator_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_moderation_reason_required check (decision = 'approved' or nullif(trim(reason), '') is not null)
);

create index job_moderation_job_id_idx on public.job_moderation (job_id, created_at desc);

create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index job_reports_status_idx on public.job_reports (status, created_at);

create table public.job_views (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  source text not null default 'direct' check (char_length(source) <= 40),
  referrer text check (referrer is null or char_length(referrer) <= 500),
  viewed_at timestamptz not null default now()
);

create index job_views_job_id_idx on public.job_views (job_id, viewed_at);

-- ---------------------------------------------------------------------------
-- Planos e assinaturas (criadas vazias, para a cobrança futura)
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year', 'one_time')),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on public.subscriptions (company_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- LGPD: consentimentos, notificações e auditoria
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  purpose public.consent_purpose not null,
  granted boolean not null,
  term_version text not null,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index consents_profile_id_idx on public.consents (profile_id, purpose, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  template text not null,
  to_address text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'queued',
  attempts smallint not null default 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_queue_idx on public.notifications (status, created_at) where status = 'queued';
create index notifications_profile_id_idx on public.notifications (profile_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
