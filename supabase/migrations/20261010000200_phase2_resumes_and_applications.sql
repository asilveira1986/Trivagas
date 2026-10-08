-- Trivagas · Fase 2 · Currículo, candidatura, funil e envio de e-mails

-- Leitura do currículo reconhece o dono pela coluna da linha (necessário para INSERT ... RETURNING,
-- pois can_view_resume() ainda não enxerga a linha recém-inserida).
drop policy "resumes: leitura conforme consentimento" on public.resumes;
create policy "resumes: leitura conforme consentimento" on public.resumes for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_view_resume(id));

-- ---------------------------------------------------------------------------
-- Currículo: salva dados pessoais, currículo e listas numa única transação
-- ---------------------------------------------------------------------------
create or replace function public.save_resume(
  personal jsonb,
  resume jsonb,
  experiences jsonb default '[]'::jsonb,
  education jsonb default '[]'::jsonb,
  skills jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  saved_id uuid;
  city integer := nullif(personal ->> 'city_id', '')::integer;
begin
  if uid is null then
    raise exception 'usuário não autenticado' using errcode = '42501';
  end if;

  update public.profiles
  set full_name = left(trim(personal ->> 'full_name'), 120),
      phone = nullif(regexp_replace(coalesce(personal ->> 'phone', ''), '[^0-9+]', '', 'g'), ''),
      city_id = city,
      last_active_at = now()
  where id = uid;

  insert into public.resumes (
    profile_id, headline, objective, city_id, area_id, education_level, desired_salary, languages, search_radius_km
  )
  values (
    uid,
    nullif(trim(resume ->> 'headline'), ''),
    nullif(trim(resume ->> 'objective'), ''),
    city,
    nullif(resume ->> 'area_id', '')::uuid,
    nullif(resume ->> 'education_level', '')::public.education_level,
    nullif(resume ->> 'desired_salary', '')::numeric,
    coalesce(resume -> 'languages', '[]'::jsonb),
    coalesce(nullif(resume ->> 'search_radius_km', '')::integer, 30)
  )
  on conflict (profile_id) do update
  set headline = excluded.headline,
      objective = excluded.objective,
      city_id = excluded.city_id,
      area_id = excluded.area_id,
      education_level = excluded.education_level,
      desired_salary = excluded.desired_salary,
      languages = excluded.languages,
      search_radius_km = excluded.search_radius_km
  returning id into saved_id;

  delete from public.resume_experiences where resume_id = saved_id;
  insert into public.resume_experiences (resume_id, company_name, role_title, started_on, ended_on, is_current, activities)
  select saved_id,
         trim(x ->> 'company_name'),
         trim(x ->> 'role_title'),
         (x ->> 'started_on')::date,
         case when coalesce((x ->> 'is_current')::boolean, false) then null else nullif(x ->> 'ended_on', '')::date end,
         coalesce((x ->> 'is_current')::boolean, false),
         nullif(trim(x ->> 'activities'), '')
  from jsonb_array_elements(coalesce(experiences, '[]'::jsonb)) x;

  delete from public.resume_education where resume_id = saved_id;
  insert into public.resume_education (resume_id, course, institution, level, is_course, started_on, ended_on, is_current)
  select saved_id,
         trim(x ->> 'course'),
         trim(x ->> 'institution'),
         (x ->> 'level')::public.education_level,
         coalesce((x ->> 'is_course')::boolean, false),
         nullif(x ->> 'started_on', '')::date,
         case when coalesce((x ->> 'is_current')::boolean, false) then null else nullif(x ->> 'ended_on', '')::date end,
         coalesce((x ->> 'is_current')::boolean, false)
  from jsonb_array_elements(coalesce(education, '[]'::jsonb)) x;

  delete from public.resume_skills where resume_id = saved_id;
  insert into public.resume_skills (resume_id, skill_id, level)
  select saved_id, (x ->> 'skill_id')::uuid, coalesce(nullif(x ->> 'level', ''), 'intermediate')::public.skill_level
  from jsonb_array_elements(coalesce(skills, '[]'::jsonb)) x
  on conflict do nothing;

  return saved_id;
end;
$$;

-- Tempo total de experiência em meses (períodos sobrepostos contam uma vez).
create or replace function public.resume_experience_months(target_resume uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  with periods as (
    select daterange(started_on, coalesce(ended_on, current_date), '[]') as period
    from public.resume_experiences
    where resume_id = target_resume and started_on <= coalesce(ended_on, current_date)
  ),
  merged as (select unnest(range_agg(period)) as period from periods)
  select coalesce(sum(
    extract(year from age(upper(period), lower(period))) * 12 + extract(month from age(upper(period), lower(period)))
  ), 0)::integer from merged;
$$;

-- ---------------------------------------------------------------------------
-- Candidatura em poucos passos: cria o currículo se faltar, valida as respostas
-- de triagem e registra o consentimento de compartilhamento com a empresa
-- ---------------------------------------------------------------------------
create or replace function public.apply_to_job(
  target_job uuid,
  answers jsonb default '[]'::jsonb,
  origin text default null,
  consent_version text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  candidate_resume uuid;
  application uuid;
  question record;
  answer text;
begin
  if uid is null then
    raise exception 'usuário não autenticado' using errcode = '42501';
  end if;
  if public.current_user_role() is distinct from 'candidate' then
    raise exception 'apenas candidatos podem se candidatar' using errcode = '42501';
  end if;
  if nullif(consent_version, '') is null then
    raise exception 'é preciso autorizar o envio do currículo à empresa' using errcode = '22023';
  end if;
  if not exists (select 1 from public.jobs where id = target_job and status = 'published') then
    raise exception 'a vaga não está recebendo candidaturas' using errcode = '42501';
  end if;

  insert into public.resumes (profile_id, city_id)
  select uid, p.city_id from public.profiles p where p.id = uid
  on conflict (profile_id) do nothing;
  select id into candidate_resume from public.resumes where profile_id = uid;

  if exists (select 1 from public.applications where job_id = target_job and resume_id = candidate_resume) then
    raise exception 'você já se candidatou a esta vaga' using errcode = '23505';
  end if;

  for question in
    select q.id, q.question, q.type, q.options, q.is_required
    from public.job_questions q where q.job_id = target_job
  loop
    select nullif(trim(a ->> 'answer'), '') into answer
    from jsonb_array_elements(coalesce(answers, '[]'::jsonb)) a
    where a ->> 'question_id' = question.id::text
    limit 1;

    if answer is null and question.is_required then
      raise exception 'responda à pergunta: %', question.question using errcode = '22023';
    end if;
    if answer is not null and question.type = 'yes_no' and answer not in ('Sim', 'Não') then
      raise exception 'resposta inválida para: %', question.question using errcode = '22023';
    end if;
    if answer is not null and question.type = 'single_choice' and not (answer = any (question.options)) then
      raise exception 'resposta inválida para: %', question.question using errcode = '22023';
    end if;
  end loop;

  insert into public.applications (job_id, resume_id, source, source_detail)
  values (target_job, candidate_resume, 'link', left(nullif(lower(origin), ''), 40))
  returning id into application;

  insert into public.application_answers (application_id, question_id, answer)
  select application, q.id, left(trim(a ->> 'answer'), 2000)
  from jsonb_array_elements(coalesce(answers, '[]'::jsonb)) a
  join public.job_questions q on q.id::text = a ->> 'question_id' and q.job_id = target_job
  where nullif(trim(a ->> 'answer'), '') is not null;

  insert into public.consents (profile_id, purpose, granted, term_version, job_id)
  values (uid, 'application', true, left(consent_version, 40), target_job);

  update public.profiles set last_active_at = now() where id = uid;
  return application;
end;
$$;

revoke execute on function public.apply_to_job(uuid, jsonb, text, text) from public, anon;
grant execute on function public.apply_to_job(uuid, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos: nova candidatura (empresa e candidato) e mudança de etapa (candidato)
-- ---------------------------------------------------------------------------
create or replace function public.queue_profile_notification(target_profile uuid, template_name text, data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, template, to_address, payload)
  select p.id, template_name, p.email, coalesce(data, '{}'::jsonb)
  from public.profiles p
  where p.id = target_profile and p.email is not null and p.blocked_at is null;
$$;

create or replace function public.queue_job_team_notification(target_job uuid, template_name text, data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, template, to_address, payload)
  select p.id, template_name, p.email, coalesce(data, '{}'::jsonb)
  from public.jobs j
  join public.company_members m on m.company_id = j.company_id
  join public.profiles p on p.id = m.profile_id
  where j.id = target_job and p.email is not null and p.blocked_at is null;
$$;

revoke execute on function public.queue_profile_notification(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.queue_job_team_notification(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.applications_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  info record;
begin
  select j.id as job_id, j.title as job_title, j.slug as job_slug, c.trade_name as company_name,
         p.id as candidate_id, p.full_name as candidate_name
  into info
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.resumes r on r.id = new.resume_id
  join public.profiles p on p.id = r.profile_id
  where j.id = new.job_id;

  if tg_op = 'INSERT' then
    perform public.queue_job_team_notification(new.job_id, 'new_application', jsonb_build_object(
      'application_id', new.id, 'job_id', info.job_id, 'job_title', info.job_title,
      'candidate_name', info.candidate_name, 'source', new.source));
    perform public.queue_profile_notification(info.candidate_id, 'application_received', jsonb_build_object(
      'application_id', new.id, 'job_title', info.job_title, 'job_slug', info.job_slug, 'company_name', info.company_name));
  elsif new.stage <> old.stage and new.stage in ('interview', 'approved', 'rejected') then
    perform public.queue_profile_notification(info.candidate_id, 'application_stage_changed', jsonb_build_object(
      'application_id', new.id, 'job_title', info.job_title, 'company_name', info.company_name, 'stage', new.stage));
  end if;
  return new;
end;
$$;

create trigger applications_notify
  after insert or update of stage on public.applications
  for each row execute function public.applications_notify();

-- ---------------------------------------------------------------------------
-- Fila de e-mails: reserva um lote (sem duplicar envios entre processos)
-- ---------------------------------------------------------------------------
create or replace function public.claim_notifications(batch_size integer default 50)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.notifications n
  set status = 'sending', locked_at = now(), attempts = n.attempts + 1
  where n.id in (
    select id from public.notifications
    where channel = 'email'
      and attempts < 5
      and (status = 'queued' or (status = 'sending' and locked_at < now() - interval '10 minutes'))
    order by created_at
    limit least(greatest(batch_size, 1), 200)
    for update skip locked
  )
  returning n.*;
end;
$$;

create or replace function public.finish_notification(target uuid, delivered boolean, failure text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set status = case
        when delivered then 'sent'::public.notification_status
        when attempts >= 5 then 'failed'::public.notification_status
        else 'queued'::public.notification_status
      end,
      sent_at = case when delivered then now() end,
      error = left(failure, 1000),
      locked_at = null
  where id = target;
$$;

revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function public.finish_notification(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.finish_notification(uuid, boolean, text) to service_role;
