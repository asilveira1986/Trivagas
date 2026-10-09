-- Trivagas · Fase 4 · Lançamento nacional: busca pública, métricas, catálogos, denúncias,
-- limite de requisições e retenção de currículos inativos

-- ---------------------------------------------------------------------------
-- Busca pública de vagas (visitantes e candidatos)
-- Com cidade: vagas dentro do raio (mais próximas primeiro) e, em seguida, as remotas.
-- ---------------------------------------------------------------------------
create or replace function public.search_jobs(
  query text default null,
  center_city integer default null,
  radius_km integer default null,
  area uuid default null,
  mode public.work_mode default null,
  contract public.contract_type default null,
  page_size integer default 20,
  page_offset integer default 0
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
  total_count bigint
)
language plpgsql
stable
security invoker
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
    j.id, j.slug, j.title, co.trade_name, co.slug, co.logo_path, ci.name, s.uf::text,
    j.work_mode, j.contract_type, j.salary_min, j.salary_max, j.published_at,
    case when center_location is not null and ci.location is not null
      then round((st_distance(ci.location, center_location) / 1000.0)::numeric, 1)::double precision end,
    count(*) over ()
  from jobs j
  join companies co on co.id = j.company_id
  left join cities ci on ci.id = j.city_id
  left join states s on s.code = ci.state_code
  where j.status = 'published'
    and (ts is null or j.search_vector @@ ts)
    and (search_jobs.area is null or j.area_id = search_jobs.area)
    and (mode is null or j.work_mode = mode)
    and (contract is null or j.contract_type = contract)
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

grant execute on function public.search_jobs(text, integer, integer, uuid, public.work_mode, public.contract_type, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tempo de moderação: guardado na decisão (o envio pode se repetir depois)
-- ---------------------------------------------------------------------------
alter table public.job_moderation add column wait_seconds integer;

create or replace function public.job_moderation_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    new.moderator_id := (select auth.uid());
  end if;
  select extract(epoch from (now() - j.submitted_at))::integer into new.wait_seconds
  from public.jobs j where j.id = new.job_id and j.status = 'in_review' and j.submitted_at is not null;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Métricas gerais do portal (somente administrador)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas administradores' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'companies_active', (select count(*) from public.companies where status = 'approved'),
    'companies_pending', (select count(*) from public.companies where status = 'pending'),
    'jobs_published', (select count(*) from public.jobs where status = 'published'),
    'jobs_in_review', (select count(*) from public.jobs where status = 'in_review'),
    'applications_total', (select count(*) from public.applications),
    'applications_30d', (select count(*) from public.applications where created_at > now() - interval '30 days'),
    'candidates', (select count(*) from public.profiles where role = 'candidate'),
    'signups_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'resumes_total', (select count(*) from public.resumes),
    'talent_pool_active', (select count(*) from public.resumes where talent_pool_status = 'active'),
    'reports_open', (select count(*) from public.job_reports where status in ('open', 'reviewing')),
    'avg_moderation_hours_30d', (
      select round(avg(wait_seconds) / 3600.0, 1) from public.job_moderation
      where wait_seconds is not null and created_at > now() - interval '30 days'
    ),
    'job_views_30d', (select count(*) from public.job_views where viewed_at > now() - interval '30 days')
  );
end;
$$;

revoke execute on function public.admin_metrics() from public, anon;
grant execute on function public.admin_metrics() to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogos: endereço amigável automático para áreas e habilidades
-- ---------------------------------------------------------------------------
create or replace function public.catalog_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  if new.slug is null or new.slug = '' or (tg_op = 'UPDATE' and new.name <> old.name) then
    new.slug := public.slugify(new.name);
  end if;
  return new;
end;
$$;

create trigger areas_slug before insert or update on public.areas for each row execute function public.catalog_slug();
create trigger skills_slug before insert or update on public.skills for each row execute function public.catalog_slug();

-- ---------------------------------------------------------------------------
-- Limite de requisições para formulários públicos (usado pelo servidor com a chave secreta)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;

-- Devolve true se a requisição pode seguir (e conta a tentativa).
create or replace function public.hit_rate_limit(bucket_key text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hits integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (left(bucket_key, 200), now(), 1)
  on conflict (bucket) do update
  set hits = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.hits + 1 end,
      window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end
  returning hits into current_hits;

  -- Limpeza oportunista das janelas antigas.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return current_hits <= max_hits;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Denúncias passam pelo servidor (verificação anti-robô e limite por IP), não direto pela API.
drop policy "job_reports: qualquer pessoa denuncia vaga publicada" on public.job_reports;

create or replace function public.job_reports_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (profile_id, template, to_address, payload)
  select p.id, 'job_reported', p.email,
         jsonb_build_object('report_id', new.id, 'job_id', new.job_id, 'reason', new.reason,
                            'job_title', (select title from public.jobs where id = new.job_id))
  from public.profiles p
  where p.role = 'admin' and p.blocked_at is null and p.email is not null
    -- Um aviso por vaga: novas denúncias da mesma vaga, enquanto houver outra aberta, não geram e-mail.
    and not exists (
      select 1 from public.job_reports r
      where r.job_id = new.job_id and r.id <> new.id and r.status in ('open', 'reviewing')
    );
  return new;
end;
$$;

create trigger job_reports_notify
  after insert on public.job_reports
  for each row execute function public.job_reports_notify();

-- Aviso de moderação informa se a vaga estava no ar (retirada após denúncia, p. ex.).
create or replace function public.job_moderation_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  moderated record;
  previous_status public.job_status;
begin
  select status into previous_status from public.jobs where id = new.job_id;

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
        'decision', new.decision, 'reason', new.reason,
        'was_published', previous_status in ('published', 'paused')
      )
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retenção (LGPD): candidato inativo é avisado e, sem retorno, removido em definitivo
-- ---------------------------------------------------------------------------
alter table public.profiles add column inactivity_warned_at timestamptz;

-- Atividade conta a partir do login e das ações; no máximo uma gravação a cada 12 horas.
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_active_at = now(), inactivity_warned_at = null
  where id = (select auth.uid())
    and (last_active_at < now() - interval '12 hours' or inactivity_warned_at is not null);
$$;

create or replace function public.retention_candidates()
returns table (profile_id uuid, email text, full_name text, action text, last_active_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select coalesce((select (value #>> '{}')::integer from public.app_settings where key = 'resume_retention_months'), 6) as months
  )
  select p.id, p.email, p.full_name,
         case
           when p.inactivity_warned_at is not null
                and p.inactivity_warned_at < now() - interval '25 days'
                and p.last_active_at < now() - make_interval(months => s.months) then 'delete'
           else 'warn'
         end,
         p.last_active_at
  from public.profiles p, settings s
  where p.role = 'candidate'
    and (
      (p.inactivity_warned_at is null and p.last_active_at < now() - make_interval(months => s.months - 1))
      or (p.inactivity_warned_at < now() - interval '25 days' and p.last_active_at < now() - make_interval(months => s.months))
    );
$$;

revoke execute on function public.retention_candidates() from public, anon, authenticated;
grant execute on function public.retention_candidates() to service_role;

create or replace function public.mark_inactivity_warned(targets uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.notifications (profile_id, template, to_address, payload)
  select p.id, 'inactivity_warning', p.email, jsonb_build_object('full_name', p.full_name)
  from public.profiles p
  where p.id = any (targets) and p.email is not null and p.inactivity_warned_at is null;

  update public.profiles set inactivity_warned_at = now()
  where id = any (targets) and inactivity_warned_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.mark_inactivity_warned(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_inactivity_warned(uuid[]) to service_role;

insert into public.app_settings (key, value, description) values
  ('privacy_contact_email', '"privacidade@trivagas.com.br"', 'E-mail do encarregado de dados (DPO) exibido na política de privacidade')
on conflict (key) do nothing;
