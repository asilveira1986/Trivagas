-- Trivagas · Fase 1 · Empresa, vagas, moderação e avisos

-- ---------------------------------------------------------------------------
-- CNPJ: dígitos verificadores, aceitando o formato alfanumérico (a partir de 07/2026)
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_cnpj(value text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  w1 constant int[] := '{5,4,3,2,9,8,7,6,5,4,3,2}';
  w2 constant int[] := '{6,5,4,3,2,9,8,7,6,5,4,3,2}';
  total int;
  remainder int;
  i int;
begin
  if value is null or value !~ '^[0-9A-Z]{12}[0-9]{2}$' or value ~ '^(.)\1{13}$' then
    return false;
  end if;

  total := 0;
  for i in 1..12 loop
    total := total + (ascii(substr(value, i, 1)) - 48) * w1[i];
  end loop;
  remainder := total % 11;
  if (case when remainder < 2 then 0 else 11 - remainder end) <> substr(value, 13, 1)::int then
    return false;
  end if;

  total := 0;
  for i in 1..13 loop
    total := total + (ascii(substr(value, i, 1)) - 48) * w2[i];
  end loop;
  remainder := total % 11;
  return (case when remainder < 2 then 0 else 11 - remainder end) = substr(value, 14, 1)::int;
end;
$$;

alter table public.companies drop constraint companies_cnpj_check;
-- text (e não char(14)) para aceitar o valor formatado; o gatilho remove a pontuação antes da checagem.
alter table public.companies alter column cnpj type text;
alter table public.companies add constraint companies_cnpj_valid check (public.is_valid_cnpj(cnpj));

-- A política de leitura checa a empresa pela coluna da própria linha: necessário para
-- INSERT ... RETURNING, pois can_view_job() ainda não enxerga a linha recém-inserida.
drop policy "jobs: publicadas são públicas" on public.jobs;
create policy "jobs: publicadas são públicas" on public.jobs for select to anon, authenticated
  using (status = 'published' or public.is_company_member(company_id) or public.can_view_job(id));

-- Idem para empresas: o vínculo do criador (company_members) é gravado por gatilho após a linha.
drop policy "companies: aprovadas são públicas" on public.companies;
create policy "companies: aprovadas são públicas" on public.companies for select to anon, authenticated
  using (
    status = 'approved'
    or created_by = (select auth.uid())
    or public.is_company_member(id)
    or public.is_admin()
  );

-- Cada usuário de empresa pertence a uma única empresa.
create unique index company_members_one_company_idx on public.company_members (profile_id);

-- ---------------------------------------------------------------------------
-- Vagas: data de envio para análise (base do tempo médio de moderação)
-- ---------------------------------------------------------------------------
alter table public.jobs add column submitted_at timestamptz;
create index jobs_in_review_idx on public.jobs (submitted_at) where status = 'in_review';

create or replace function public.jobs_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acting_admin boolean := public.is_admin();
  system_actor boolean := public.is_privileged();
begin
  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := public.unique_slug(new.title, 'public.jobs');
    end if;
    if not system_actor and not acting_admin then
      new.created_by := (select auth.uid());
      if new.status not in ('draft', 'in_review') then
        raise exception 'vaga nova deve começar como rascunho ou em análise' using errcode = '42501';
      end if;
    end if;
  else
    if new.company_id <> old.company_id then
      raise exception 'empresa da vaga não pode ser alterada' using errcode = '42501';
    end if;
    if new.slug <> old.slug and not acting_admin and not system_actor then
      raise exception 'endereço da vaga não pode ser alterado' using errcode = '42501';
    end if;

    if not system_actor and not acting_admin then
      new.created_by := old.created_by;
      new.submitted_at := old.submitted_at;

      if new.status <> old.status and not (
        (old.status = 'draft'     and new.status in ('in_review', 'closed')) or
        (old.status = 'in_review' and new.status = 'draft') or
        (old.status = 'rejected'  and new.status in ('draft', 'in_review')) or
        (old.status = 'published' and new.status in ('paused', 'closed')) or
        (old.status = 'paused'    and new.status in ('published', 'closed')) or
        (old.status = 'closed'    and new.status = 'in_review')
      ) then
        raise exception 'transição de status não permitida: % -> %', old.status, new.status using errcode = '42501';
      end if;

      -- Edição de campo sensível em vaga publicada ou pausada volta para análise.
      if old.status in ('published', 'paused')
         and (new.title is distinct from old.title
              or new.description is distinct from old.description
              or new.salary_min is distinct from old.salary_min
              or new.salary_max is distinct from old.salary_max) then
        new.status := 'in_review';
      end if;
    end if;
  end if;

  if new.status = 'in_review' and (tg_op = 'INSERT' or old.status <> 'in_review') then
    new.submitted_at := now();
  end if;

  if new.status = 'published' then
    if not exists (select 1 from public.companies where id = new.company_id and status = 'approved') then
      raise exception 'a empresa precisa estar aprovada para publicar vagas' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' or old.status <> 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  end if;

  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Empresas: reprovada volta para análise quando a empresa corrige os dados
-- ---------------------------------------------------------------------------
create or replace function public.companies_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acting_admin boolean := public.is_admin();
begin
  new.cnpj := upper(regexp_replace(new.cnpj, '[^0-9A-Za-z]', '', 'g'));

  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := public.unique_slug(new.trade_name, 'public.companies');
    end if;
    if not public.is_privileged() and not acting_admin then
      if public.current_user_role() is distinct from 'company' then
        raise exception 'apenas usuários do tipo empresa podem cadastrar empresas' using errcode = '42501';
      end if;
      if exists (select 1 from public.company_members where profile_id = (select auth.uid())) then
        raise exception 'este usuário já pertence a uma empresa' using errcode = '42501';
      end if;
      new.created_by := (select auth.uid());
      new.status := 'pending';
      new.status_reason := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  if public.is_privileged() or acting_admin then
    if new.status is distinct from old.status and acting_admin then
      new.reviewed_by := (select auth.uid());
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.status_reason is distinct from old.status_reason
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'situação do cadastro só pode ser alterada pelo administrador' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'criador da empresa não pode ser alterado' using errcode = '42501';
  end if;
  if new.slug <> old.slug then
    raise exception 'endereço da empresa não pode ser alterado' using errcode = '42501';
  end if;
  -- Mudança de CNPJ ou razão social exige nova validação; cadastro reprovado e corrigido volta para análise.
  if ((new.cnpj is distinct from old.cnpj or new.legal_name is distinct from old.legal_name) and old.status = 'approved')
     or old.status = 'rejected' then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuários da empresa
-- ---------------------------------------------------------------------------
-- A empresa precisa manter ao menos um administrador.
create or replace function public.company_members_keep_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and exists (select 1 from public.companies where id = old.company_id)
     and exists (select 1 from public.profiles where id = old.profile_id)
     and not exists (
       select 1 from public.company_members
       where company_id = old.company_id and role = 'admin' and profile_id <> old.profile_id
     ) then
    raise exception 'a empresa precisa ter ao menos um administrador' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger company_members_keep_admin
  before update or delete on public.company_members
  for each row execute function public.company_members_keep_admin();

-- Adiciona à empresa um usuário que já tem conta do tipo empresa.
create or replace function public.add_company_member(
  target_company uuid,
  member_email text,
  member_role public.company_member_role default 'recruiter'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid;
begin
  if not (public.is_company_admin(target_company) or public.is_admin()) then
    raise exception 'apenas administradores da empresa podem adicionar usuários' using errcode = '42501';
  end if;

  select id into member
  from public.profiles
  where lower(email) = lower(trim(member_email)) and role = 'company' and blocked_at is null;

  if member is null then
    raise exception 'nenhuma conta de empresa com este e-mail; peça para a pessoa criar a conta antes' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.company_members where profile_id = member) then
    raise exception 'este usuário já pertence a uma empresa' using errcode = '23505';
  end if;

  insert into public.company_members (company_id, profile_id, role) values (target_company, member, member_role);
  return member;
end;
$$;

revoke execute on function public.add_company_member(uuid, text, public.company_member_role) from public, anon;
grant execute on function public.add_company_member(uuid, text, public.company_member_role) to authenticated;

-- ---------------------------------------------------------------------------
-- Salvar vaga com habilidades e perguntas numa única transação (RLS do usuário se aplica)
-- ---------------------------------------------------------------------------
create or replace function public.save_job(
  target_job uuid,
  target_company uuid,
  job jsonb,
  skills jsonb default '[]'::jsonb,
  questions jsonb default '[]'::jsonb,
  submit boolean default false
)
returns table (job_id uuid, job_slug text, job_status public.job_status)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
  saved_status public.job_status;
begin
  if target_job is null then
    insert into public.jobs (
      company_id, title, description, area_id, contract_type, work_mode, city_id,
      salary_min, salary_max, benefits, positions, closes_at, region_mode, radius_km,
      min_education, min_experience_months, status
    )
    values (
      target_company,
      job ->> 'title',
      coalesce(job ->> 'description', ''),
      nullif(job ->> 'area_id', '')::uuid,
      (job ->> 'contract_type')::public.contract_type,
      (job ->> 'work_mode')::public.work_mode,
      nullif(job ->> 'city_id', '')::integer,
      nullif(job ->> 'salary_min', '')::numeric,
      nullif(job ->> 'salary_max', '')::numeric,
      coalesce(array(select jsonb_array_elements_text(job -> 'benefits')), '{}'),
      coalesce(nullif(job ->> 'positions', '')::integer, 1),
      nullif(job ->> 'closes_at', '')::date,
      coalesce(nullif(job ->> 'region_mode', ''), 'prioritize')::public.region_mode,
      coalesce(nullif(job ->> 'radius_km', '')::integer, 30),
      nullif(job ->> 'min_education', '')::public.education_level,
      nullif(job ->> 'min_experience_months', '')::integer,
      case when submit then 'in_review'::public.job_status else 'draft'::public.job_status end
    )
    returning id into saved_id;
  else
    update public.jobs j
    set title = job ->> 'title',
        description = coalesce(job ->> 'description', ''),
        area_id = nullif(job ->> 'area_id', '')::uuid,
        contract_type = (job ->> 'contract_type')::public.contract_type,
        work_mode = (job ->> 'work_mode')::public.work_mode,
        city_id = nullif(job ->> 'city_id', '')::integer,
        salary_min = nullif(job ->> 'salary_min', '')::numeric,
        salary_max = nullif(job ->> 'salary_max', '')::numeric,
        benefits = coalesce(array(select jsonb_array_elements_text(job -> 'benefits')), '{}'),
        positions = coalesce(nullif(job ->> 'positions', '')::integer, 1),
        closes_at = nullif(job ->> 'closes_at', '')::date,
        region_mode = coalesce(nullif(job ->> 'region_mode', ''), 'prioritize')::public.region_mode,
        radius_km = coalesce(nullif(job ->> 'radius_km', '')::integer, 30),
        min_education = nullif(job ->> 'min_education', '')::public.education_level,
        min_experience_months = nullif(job ->> 'min_experience_months', '')::integer
    where j.id = target_job
    returning j.id, j.status into saved_id, saved_status;

    if saved_id is null then
      raise exception 'vaga não encontrada' using errcode = 'P0002';
    end if;
    if submit and saved_status in ('draft', 'rejected', 'closed') then
      update public.jobs set status = 'in_review' where id = saved_id;
    end if;
  end if;

  delete from public.job_skills where job_skills.job_id = saved_id;
  insert into public.job_skills (job_id, skill_id, requirement)
  select saved_id, (s ->> 'skill_id')::uuid, coalesce(nullif(s ->> 'requirement', ''), 'required')::public.skill_requirement
  from jsonb_array_elements(coalesce(skills, '[]'::jsonb)) s
  on conflict do nothing;

  -- Perguntas: remove as que saíram, atualiza as existentes e cria as novas (na ordem recebida).
  delete from public.job_questions q
  where q.job_id = saved_id
    and q.id not in (
      select (x ->> 'id')::uuid from jsonb_array_elements(coalesce(questions, '[]'::jsonb)) x
      where nullif(x ->> 'id', '') is not null
    );

  update public.job_questions q
  set question = x.item ->> 'question',
      type = (x.item ->> 'type')::public.question_type,
      options = coalesce(array(select jsonb_array_elements_text(x.item -> 'options')), '{}'),
      is_required = coalesce((x.item ->> 'is_required')::boolean, true),
      position = x.ord
  from jsonb_array_elements(coalesce(questions, '[]'::jsonb)) with ordinality as x(item, ord)
  where q.job_id = saved_id and q.id = nullif(x.item ->> 'id', '')::uuid;

  insert into public.job_questions (job_id, position, question, type, options, is_required)
  select saved_id, x.ord, x.item ->> 'question', (x.item ->> 'type')::public.question_type,
         coalesce(array(select jsonb_array_elements_text(x.item -> 'options')), '{}'),
         coalesce((x.item ->> 'is_required')::boolean, true)
  from jsonb_array_elements(coalesce(questions, '[]'::jsonb)) with ordinality as x(item, ord)
  where nullif(x.item ->> 'id', '') is null;

  return query select j.id, j.slug, j.status from public.jobs j where j.id = saved_id;
end;
$$;

-- Duplica a vaga como rascunho, com habilidades e perguntas.
create or replace function public.duplicate_job(source_job uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copy_id uuid;
begin
  insert into public.jobs (
    company_id, title, description, area_id, contract_type, work_mode, city_id,
    salary_min, salary_max, benefits, positions, region_mode, radius_km,
    min_education, min_experience_months, status
  )
  select company_id, left(title, 111) || ' (cópia)', description, area_id, contract_type, work_mode, city_id,
         salary_min, salary_max, benefits, positions, region_mode, radius_km,
         min_education, min_experience_months, 'draft'
  from public.jobs
  where id = source_job
  returning id into copy_id;

  if copy_id is null then
    raise exception 'vaga não encontrada' using errcode = 'P0002';
  end if;

  insert into public.job_skills (job_id, skill_id, requirement)
  select copy_id, skill_id, requirement from public.job_skills where job_id = source_job;

  insert into public.job_questions (job_id, position, question, type, options, is_required)
  select copy_id, position, question, type, options, is_required from public.job_questions where job_id = source_job;

  return copy_id;
end;
$$;

-- Visualizações por vaga e origem (respeita o RLS de job_views).
create or replace function public.job_view_counts(target_jobs uuid[])
returns table (job_id uuid, source text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.job_id, v.source, count(*)
  from public.job_views v
  where v.job_id = any (target_jobs)
  group by v.job_id, v.source;
$$;

-- ---------------------------------------------------------------------------
-- Avisos por e-mail (fila em notifications; o envio entra na Fase 2)
-- ---------------------------------------------------------------------------
create or replace function public.queue_company_notification(target_company uuid, template_name text, data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, template, to_address, payload)
  select p.id, template_name, p.email, coalesce(data, '{}'::jsonb)
  from public.company_members m
  join public.profiles p on p.id = m.profile_id
  where m.company_id = target_company and m.role = 'admin' and p.email is not null and p.blocked_at is null;
$$;

revoke execute on function public.queue_company_notification(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.job_moderation_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  moderated record;
begin
  update public.jobs
  set status = case new.decision
      when 'approved' then 'published'::public.job_status
      when 'rejected' then 'rejected'::public.job_status
      else 'draft'::public.job_status
    end
  where id = new.job_id
  returning id, company_id, title, slug into moderated;

  if moderated.id is not null then
    perform public.queue_company_notification(
      moderated.company_id,
      'job_moderated',
      jsonb_build_object(
        'job_id', moderated.id, 'job_title', moderated.title, 'job_slug', moderated.slug,
        'decision', new.decision, 'reason', new.reason
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.companies_notify_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected', 'blocked') then
    perform public.queue_company_notification(
      new.id,
      'company_reviewed',
      jsonb_build_object('company_id', new.id, 'trade_name', new.trade_name, 'status', new.status, 'reason', new.status_reason)
    );
  end if;
  return new;
end;
$$;

create trigger companies_notify_review
  after update of status on public.companies
  for each row when (old.status is distinct from new.status)
  execute function public.companies_notify_review();

-- Aviso prévio: vagas que encerram em 3 dias (uma vez por vaga e data).
create or replace function public.queue_job_closing_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  job record;
  queued integer := 0;
  target_date date := (now() at time zone 'America/Sao_Paulo')::date + 3;
begin
  for job in
    select j.id, j.company_id, j.title, j.slug, j.closes_at
    from public.jobs j
    where j.status in ('published', 'paused')
      and j.closes_at = target_date
      and not exists (
        select 1 from public.notifications n
        where n.template = 'job_closing_soon'
          and n.payload ->> 'job_id' = j.id::text
          and n.payload ->> 'closes_at' = j.closes_at::text
      )
  loop
    perform public.queue_company_notification(
      job.company_id,
      'job_closing_soon',
      jsonb_build_object('job_id', job.id, 'job_title', job.title, 'job_slug', job.slug, 'closes_at', job.closes_at)
    );
    queued := queued + 1;
  end loop;
  return queued;
end;
$$;

revoke execute on function public.queue_job_closing_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agendamentos (pg_cron existe no Supabase; ambientes sem a extensão apenas ignoram)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    create extension if not exists pg_cron;
    -- 00:05 e 09:00 no horário de Brasília (UTC-3)
    perform cron.schedule('trivagas-close-expired-jobs', '5 3 * * *', 'select public.close_expired_jobs()');
    perform cron.schedule('trivagas-job-closing-reminders', '0 12 * * *', 'select public.queue_job_closing_reminders()');
  else
    raise notice 'pg_cron indisponível neste banco: agendamentos não criados';
  end if;
end;
$$;
