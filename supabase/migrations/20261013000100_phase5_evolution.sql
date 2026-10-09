-- Trivagas · Fase 5 · Evolução: vagas afirmativas e confidenciais, declaração de deficiência,
-- alertas de vagas, WhatsApp e relatórios da empresa

-- ---------------------------------------------------------------------------
-- Vagas afirmativas e confidenciais
-- ---------------------------------------------------------------------------
create type public.affirmative_kind as enum ('pcd', 'women', 'black_people', 'indigenous', 'lgbtqia', 'people_50_plus');

alter table public.jobs
  add column affirmative public.affirmative_kind,
  add column is_confidential boolean not null default false;

-- Vaga confidencial: a empresa não aparece para quem não tem vínculo com a vaga.
-- A leitura pública passa pelas funções public_job() e search_jobs(), que ocultam a empresa.
create or replace function public.can_view_job(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.jobs where id = target_job and status = 'published' and not is_confidential)
    or public.is_job_member(target_job)
    or public.is_admin()
    or exists (
      select 1 from public.applications a
      join public.resumes r on r.id = a.resume_id
      where a.job_id = target_job and r.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.talent_invites i
      join public.resumes r on r.id = i.resume_id
      where i.job_id = target_job and r.profile_id = (select auth.uid())
    );
$$;

drop policy "jobs: publicadas são públicas" on public.jobs;
create policy "jobs: publicadas são públicas" on public.jobs for select to anon, authenticated
  using ((status = 'published' and not is_confidential) or public.is_company_member(company_id) or public.can_view_job(id));

-- Página pública da vaga (inclusive confidencial), com a empresa oculta quando for o caso.
create or replace function public.public_job(job_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', j.id, 'slug', j.slug, 'company_id', null, 'title', j.title, 'description', j.description,
    'status', j.status, 'contract_type', j.contract_type, 'work_mode', j.work_mode, 'city_id', j.city_id,
    'area_id', j.area_id, 'salary_min', j.salary_min, 'salary_max', j.salary_max, 'benefits', j.benefits,
    'positions', j.positions, 'closes_at', j.closes_at, 'region_mode', j.region_mode, 'radius_km', j.radius_km,
    'min_education', j.min_education, 'min_experience_months', j.min_experience_months,
    'published_at', j.published_at, 'submitted_at', null, 'created_at', j.created_at, 'updated_at', j.updated_at,
    'affirmative', j.affirmative, 'is_confidential', j.is_confidential,
    'areas', (select jsonb_build_object('name', a.name) from public.areas a where a.id = j.area_id),
    'cities', (
      select jsonb_build_object('name', ci.name, 'states', jsonb_build_object('uf', s.uf))
      from public.cities ci join public.states s on s.code = ci.state_code where ci.id = j.city_id
    ),
    'companies', case
      when j.is_confidential then jsonb_build_object(
        'id', null, 'slug', null, 'trade_name', 'Empresa confidencial', 'logo_path', null, 'status', 'approved',
        'description', case when c.segment is not null then 'Empresa do segmento ' || c.segment || '.' end,
        'cities', null)
      else jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'trade_name', c.trade_name, 'logo_path', c.logo_path, 'status', c.status,
        'description', c.description,
        'cities', (
          select jsonb_build_object('name', ci.name, 'states', jsonb_build_object('uf', s.uf))
          from public.cities ci join public.states s on s.code = ci.state_code where ci.id = c.city_id
        ))
    end,
    'job_skills', coalesce((
      select jsonb_agg(jsonb_build_object('requirement', js.requirement, 'skills', jsonb_build_object('id', sk.id, 'name', sk.name)))
      from public.job_skills js join public.skills sk on sk.id = js.skill_id where js.job_id = j.id
    ), '[]'::jsonb),
    'job_questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'position', q.position, 'question', q.question, 'type', q.type,
                                          'options', q.options, 'is_required', q.is_required) order by q.position)
      from public.job_questions q where q.job_id = j.id
    ), '[]'::jsonb)
  )
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.slug = job_slug and j.status = 'published';
$$;

grant execute on function public.public_job(text) to anon, authenticated;

-- Endereços das vagas publicadas para o sitemap (inclui as confidenciais).
create or replace function public.public_job_slugs()
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select slug, updated_at from public.jobs where status = 'published' order by published_at desc limit 45000;
$$;

grant execute on function public.public_job_slugs() to anon, authenticated;

-- Busca pública: inclui vagas confidenciais (empresa oculta) e filtro de vagas afirmativas.
drop function public.search_jobs(text, integer, integer, uuid, public.work_mode, public.contract_type, integer, integer);

create or replace function public.search_jobs(
  query text default null,
  center_city integer default null,
  radius_km integer default null,
  area uuid default null,
  mode public.work_mode default null,
  contract public.contract_type default null,
  page_size integer default 20,
  page_offset integer default 0,
  affirmative_only boolean default false,
  published_after timestamptz default null
)
returns table (
  id uuid,
  slug text,
  title text,
  company_name text,
  company_slug text,
  logo_path text,
  city_name text,
  uf text,
  work_mode public.work_mode,
  contract_type public.contract_type,
  salary_min numeric,
  salary_max numeric,
  published_at timestamptz,
  distance_km double precision,
  affirmative public.affirmative_kind,
  is_confidential boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  radius integer := coalesce(radius_km, (select (value #>> '{}')::integer from app_settings where key = 'default_radius_km'), 30);
  ts tsquery;
  center_location extensions.geography;
begin
  if nullif(trim(query), '') is not null then
    ts := websearch_to_tsquery('portuguese', public.immutable_unaccent(query));
  end if;
  if center_city is not null then
    select c.location into center_location from cities c where c.id = center_city;
  end if;

  return query
  select
    j.id, j.slug, j.title,
    case when j.is_confidential then 'Empresa confidencial' else co.trade_name end,
    case when j.is_confidential then null else co.slug end,
    case when j.is_confidential then null else co.logo_path end,
    ci.name, s.uf::text,
    j.work_mode, j.contract_type, j.salary_min, j.salary_max, j.published_at,
    case when center_location is not null and ci.location is not null
      then round((st_distance(ci.location, center_location) / 1000.0)::numeric, 1)::double precision end,
    j.affirmative, j.is_confidential,
    count(*) over ()
  from jobs j
  join companies co on co.id = j.company_id
  left join cities ci on ci.id = j.city_id
  left join states s on s.code = ci.state_code
  where j.status = 'published'
    and co.status = 'approved'
    and (ts is null or j.search_vector @@ ts)
    and (search_jobs.area is null or j.area_id = search_jobs.area)
    and (mode is null or j.work_mode = mode)
    and (contract is null or j.contract_type = contract)
    and (not affirmative_only or j.affirmative is not null)
    and (search_jobs.published_after is null or j.published_at > search_jobs.published_after)
    and (
      center_location is null
      or j.work_mode = 'remote'
      or (ci.location is not null and st_dwithin(ci.location, center_location, radius * 1000.0))
    )
  order by
    case when center_location is null then 0 when j.work_mode = 'remote' then 2 else 1 end,
    case when center_location is not null and ci.location is not null then st_distance(ci.location, center_location) end asc nulls last,
    j.published_at desc
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0);
end;
$$;

grant execute on function public.search_jobs(text, integer, integer, uuid, public.work_mode, public.contract_type, integer, integer, boolean, timestamptz) to anon, authenticated;

-- Nome exibido da empresa da vaga (oculto quando confidencial), para os avisos.
create or replace function public.job_company_label(target_job uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when j.is_confidential then 'Empresa confidencial' else c.trade_name end
  from public.jobs j join public.companies c on c.id = j.company_id where j.id = target_job;
$$;

-- ---------------------------------------------------------------------------
-- Declaração voluntária de deficiência (dado sensível, LGPD art. 11)
-- Visível ao candidato e, somente após candidatura a vaga PcD, à empresa dessa vaga.
-- ---------------------------------------------------------------------------
create table public.resume_disability (
  resume_id uuid primary key references public.resumes (id) on delete cascade,
  details text check (details is null or char_length(details) <= 500),
  needs_accommodation text check (needs_accommodation is null or char_length(needs_accommodation) <= 500),
  consent_version text not null,
  declared_at timestamptz not null default now()
);

alter table public.resume_disability enable row level security;

create policy "resume_disability: dono gerencia" on public.resume_disability for all to authenticated
  using (public.owns_resume(resume_id)) with check (public.owns_resume(resume_id));

create policy "resume_disability: empresa de vaga PcD lê" on public.resume_disability for select to authenticated
  using (exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.resume_id = resume_disability.resume_id and j.affirmative = 'pcd' and public.is_job_member(j.id)
  ));

create or replace function public.resume_disability_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    new.declared_at := now();
  end if;
  return new;
end;
$$;

create trigger resume_disability_guard
  before insert or update on public.resume_disability
  for each row execute function public.resume_disability_guard();

-- Registra o consentimento específico junto da declaração (e a retirada, ao apagar).
create or replace function public.resume_disability_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select profile_id into owner from public.resumes where id = coalesce(new.resume_id, old.resume_id);
  if tg_op = 'INSERT' then
    insert into public.consents (profile_id, purpose, granted, term_version)
    values (owner, 'disability_data', true, new.consent_version);
  elsif tg_op = 'DELETE' then
    insert into public.consents (profile_id, purpose, granted, term_version)
    values (owner, 'disability_data', false, 'retirada');
  end if;
  return coalesce(new, old);
end;
$$;

create trigger resume_disability_consent
  after insert or delete on public.resume_disability
  for each row execute function public.resume_disability_consent();

-- ---------------------------------------------------------------------------
-- Alertas de vagas
-- ---------------------------------------------------------------------------
create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  query text check (query is null or char_length(query) <= 100),
  city_id integer references public.cities (id),
  radius_km integer check (radius_km is null or radius_km between 0 and 1000),
  area_id uuid references public.areas (id) on delete set null,
  work_mode public.work_mode,
  contract_type public.contract_type,
  affirmative_only boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index job_alerts_profile_id_idx on public.job_alerts (profile_id);
create index job_alerts_due_idx on public.job_alerts (last_sent_at) where active;

alter table public.job_alerts enable row level security;

create policy "job_alerts: dono gerencia" on public.job_alerts for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

create or replace function public.job_alerts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      new.profile_id := (select auth.uid());
      new.created_at := now();
      new.last_sent_at := now();  -- só avisa vagas publicadas depois de criar o alerta
      if (select count(*) from public.job_alerts where profile_id = new.profile_id) >= 5 then
        raise exception 'limite de 5 alertas por pessoa' using errcode = '23514';
      end if;
    else
      new.profile_id := old.profile_id;
      new.last_sent_at := old.last_sent_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger job_alerts_guard
  before insert or update on public.job_alerts
  for each row execute function public.job_alerts_guard();

-- Enfileira um e-mail por alerta vencido com as vagas novas (até 10). Rotina diária.
create or replace function public.queue_job_alerts()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alert record;
  jobs jsonb;
  queued integer := 0;
begin
  for alert in
    select a.*, p.email, p.full_name, p.whatsapp_opt_in, p.phone
    from job_alerts a
    join profiles p on p.id = a.profile_id and p.blocked_at is null and p.email is not null
    where a.active
      and (a.last_sent_at is null
           or (a.frequency = 'daily' and a.last_sent_at < now() - interval '20 hours')
           or (a.frequency = 'weekly' and a.last_sent_at < now() - interval '6 days 20 hours'))
  loop
    select jsonb_agg(jsonb_build_object(
             'title', r.title, 'slug', r.slug, 'company_name', r.company_name,
             'city', case when r.work_mode = 'remote' then 'Remoto' else r.city_name || ' - ' || r.uf end))
    into jobs
    from public.search_jobs(
      query => alert.query, center_city => alert.city_id, radius_km => alert.radius_km, area => alert.area_id,
      mode => alert.work_mode, contract => alert.contract_type, page_size => 10,
      affirmative_only => alert.affirmative_only, published_after => coalesce(alert.last_sent_at, alert.created_at)
    ) r;

    if jobs is not null then
      perform public.queue_profile_notification(alert.profile_id, 'job_alert', jsonb_build_object(
        'alert_id', alert.id, 'alert_name', alert.name, 'jobs', jobs, 'total', jsonb_array_length(jobs)));
      queued := queued + 1;
    end if;
    update job_alerts set last_sent_at = now() where id = alert.id;
  end loop;
  return queued;
end;
$$;

revoke execute on function public.queue_job_alerts() from public, anon, authenticated;
grant execute on function public.queue_job_alerts() to service_role;

-- ---------------------------------------------------------------------------
-- WhatsApp: autorização do candidato e envio em paralelo ao e-mail para avisos-chave
-- ---------------------------------------------------------------------------
alter table public.profiles add column whatsapp_opt_in boolean not null default false;

create or replace function public.set_whatsapp_opt_in(enabled boolean, consent_version text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'usuário não autenticado' using errcode = '42501';
  end if;
  if enabled and not exists (select 1 from public.profiles where id = uid and phone is not null) then
    raise exception 'cadastre um telefone com DDD antes de ativar o WhatsApp' using errcode = '22023';
  end if;
  if enabled and nullif(consent_version, '') is null then
    raise exception 'é preciso aceitar o termo do WhatsApp' using errcode = '22023';
  end if;
  update public.profiles set whatsapp_opt_in = enabled where id = uid and whatsapp_opt_in <> enabled;
  if found then
    insert into public.consents (profile_id, purpose, granted, term_version)
    values (uid, 'whatsapp', enabled, coalesce(left(nullif(consent_version, ''), 40), 'retirada'));
  end if;
end;
$$;

revoke execute on function public.set_whatsapp_opt_in(boolean, text) from public, anon;
grant execute on function public.set_whatsapp_opt_in(boolean, text) to authenticated;

-- Usuário não altera a autorização de WhatsApp diretamente (só pela função, que registra o consentimento).
create or replace function public.profiles_guard_whatsapp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() and not public.is_admin() then
    new.whatsapp_opt_in := old.whatsapp_opt_in;
    new.inactivity_warned_at := old.inactivity_warned_at;
  end if;
  -- Sem telefone, não há WhatsApp.
  if new.phone is null then
    new.whatsapp_opt_in := false;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_whatsapp
  before update on public.profiles
  for each row execute function public.profiles_guard_whatsapp();

-- Avisos para o perfil: e-mail sempre; WhatsApp para quem autorizou, nos modelos com mensagem aprovada.
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

  insert into public.notifications (profile_id, channel, template, to_address, payload)
  select p.id, 'whatsapp', template_name, '+55' || regexp_replace(p.phone, '^\+?55', ''), coalesce(data, '{}'::jsonb)
  from public.profiles p
  where p.id = target_profile and p.whatsapp_opt_in and p.phone is not null and p.blocked_at is null
    and template_name in ('application_stage_changed', 'talent_invite', 'job_alert');
$$;

-- A fila passa a ser reservada por canal (e-mail e WhatsApp têm envios separados).
create or replace function public.claim_notifications(batch_size integer default 50, target_channel text default 'email')
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
    where channel = target_channel
      and attempts < 5
      and (status = 'queued' or (status = 'sending' and locked_at < now() - interval '10 minutes'))
    order by created_at
    limit least(greatest(batch_size, 1), 200)
    for update skip locked
  )
  returning n.*;
end;
$$;

drop function public.claim_notifications(integer);
revoke execute on function public.claim_notifications(integer, text) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer, text) to service_role;

-- Avisos ao candidato não revelam a empresa de vaga confidencial.
create or replace function public.applications_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  info record;
begin
  select j.id as job_id, j.title as job_title, j.slug as job_slug, public.job_company_label(j.id) as company_name,
         p.id as candidate_id, p.full_name as candidate_name
  into info
  from public.jobs j
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

create or replace function public.talent_invites_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  info record;
begin
  select j.title as job_title, j.slug as job_slug, public.job_company_label(j.id) as company_name, r.profile_id
  into info
  from public.jobs j
  join public.resumes r on r.id = new.resume_id
  where j.id = new.job_id;

  perform public.queue_profile_notification(info.profile_id, 'talent_invite', jsonb_build_object(
    'invite_id', new.id, 'job_title', info.job_title, 'job_slug', info.job_slug,
    'company_name', info.company_name, 'message', new.message));
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatórios da empresa
-- ---------------------------------------------------------------------------
create or replace function public.company_report(target_company uuid, period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => least(greatest(period_days, 1), 730));
begin
  if not (public.is_company_member(target_company) or public.is_admin()) then
    raise exception 'sem acesso aos relatórios desta empresa' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'period_days', period_days,
    'jobs', coalesce((
      select jsonb_agg(row_to_json(r) order by r.views desc, r.title)
      from (
        select
          j.id, j.title, j.status, j.published_at, j.closed_at,
          case when j.closed_at is not null and j.published_at is not null
            then round(extract(epoch from (j.closed_at - j.published_at)) / 86400.0, 1) end as days_to_close,
          (select count(*) from public.job_views v where v.job_id = j.id and v.viewed_at >= since) as views,
          (select count(*) from public.applications a where a.job_id = j.id and a.created_at >= since) as applications,
          (select jsonb_object_agg(src, total) from (
             select v.source as src, count(*) as total from public.job_views v
             where v.job_id = j.id and v.viewed_at >= since group by v.source) s) as views_by_source,
          (select jsonb_object_agg(src, total) from (
             select coalesce(case when a.source = 'invite' then 'convite' end, a.source_detail, 'direct') as src, count(*) as total
             from public.applications a where a.job_id = j.id and a.created_at >= since group by 1) s) as applications_by_source,
          (select jsonb_object_agg(stage, total) from (
             select a.stage, count(*) as total from public.applications a where a.job_id = j.id group by a.stage) s) as funnel
        from public.jobs j
        where j.company_id = target_company
          and j.status <> 'draft'
          and (j.published_at >= since or j.status in ('published', 'paused') or j.closed_at >= since)
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.company_report(uuid, integer) from public, anon;
grant execute on function public.company_report(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Candidatura a vaga confidencial: a checagem "vaga aberta" não pode depender do RLS do candidato
-- ---------------------------------------------------------------------------
create or replace function public.is_job_open(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j join public.companies c on c.id = j.company_id
    where j.id = target_job and j.status = 'published' and c.status = 'approved'
  );
$$;

create or replace function public.applications_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_job_open(new.job_id) then
      raise exception 'a vaga não está recebendo candidaturas' using errcode = '42501';
    end if;
    new.stage := 'new';
    new.rating := null;
    if new.source = 'invite' then
      new.source := 'link';
    end if;
    return new;
  end if;

  if new.job_id <> old.job_id or new.resume_id <> old.resume_id
     or new.source <> old.source or new.source_detail is distinct from old.source_detail then
    raise exception 'dados de origem da candidatura não podem ser alterados' using errcode = '42501';
  end if;
  return new;
end;
$$;


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
  if not public.is_job_open(target_job) then
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

  update public.talent_invites
  set status = 'accepted'
  where job_id = target_job and resume_id = candidate_resume and status = 'pending';

  update public.profiles set last_active_at = now() where id = uid;
  return application;
end;
$$;


-- ---------------------------------------------------------------------------
-- Salvar e duplicar vaga com os campos de vaga afirmativa e confidencial
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
      min_education, min_experience_months, affirmative, is_confidential, status
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
      nullif(job ->> 'affirmative', '')::public.affirmative_kind,
      coalesce((job ->> 'is_confidential')::boolean, false),
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
        min_experience_months = nullif(job ->> 'min_experience_months', '')::integer,
        affirmative = nullif(job ->> 'affirmative', '')::public.affirmative_kind,
        is_confidential = coalesce((job ->> 'is_confidential')::boolean, false)
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
    min_education, min_experience_months, affirmative, is_confidential, status
  )
  select company_id, left(title, 111) || ' (cópia)', description, area_id, contract_type, work_mode, city_id,
         salary_min, salary_max, benefits, positions, region_mode, radius_km,
         min_education, min_experience_months, affirmative, is_confidential, 'draft'
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
