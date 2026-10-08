-- Trivagas · Fase 3 · Banco de talentos: consentimento, busca por região e aderência, convites e favoritos

-- ---------------------------------------------------------------------------
-- Contato e PDF só depois da candidatura (ou do aceite do convite)
-- ---------------------------------------------------------------------------
create or replace function public.can_view_resume_contact(target_resume uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.owns_resume(target_resume)
    or public.is_admin()
    or exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.company_members m on m.company_id = j.company_id
      where a.resume_id = target_resume and m.profile_id = (select auth.uid())
    );
$$;

-- O PDF costuma trazer telefone e e-mail: no banco de talentos a empresa vê só o perfil estruturado.
drop policy "resumes bucket: dono lê" on storage.objects;
create policy "resumes bucket: dono lê" on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.resumes r
        where r.pdf_path = name and public.can_view_resume_contact(r.id)
      )
    )
  );

-- Nome abreviado ("Ana F."): identifica o perfil sem expor o nome completo antes do aceite.
create or replace function public.short_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (select string_to_array(regexp_replace(trim(coalesce(full_name, '')), '\s+', ' ', 'g'), ' ') as p)
  select case
    when cardinality(p) = 0 or p[1] = '' then 'Candidato'
    when cardinality(p) = 1 then p[1]
    else p[1] || ' ' || upper(left(p[cardinality(p)], 1)) || '.'
  end
  from parts;
$$;

-- Dados de identificação do talento para a empresa (nome abreviado até liberar o contato).
create or replace function public.talent_identity(target_resume uuid)
returns table (display_name text, contact_released boolean, application_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when public.can_view_resume_contact(r.id) then p.full_name else public.short_name(p.full_name) end,
    public.can_view_resume_contact(r.id),
    (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.company_members m on m.company_id = j.company_id
      where a.resume_id = r.id and m.profile_id = (select auth.uid())
      order by a.created_at desc
      limit 1
    )
  from public.resumes r
  join public.profiles p on p.id = r.profile_id
  where r.id = target_resume and public.can_view_resume(r.id);
$$;

-- ---------------------------------------------------------------------------
-- Consentimento do banco de talentos (participar, pausar, retirar)
-- ---------------------------------------------------------------------------
create or replace function public.set_talent_pool(new_status public.talent_pool_status, consent_version text default null)
returns public.talent_pool_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  previous public.talent_pool_status;
begin
  if uid is null then
    raise exception 'usuário não autenticado' using errcode = '42501';
  end if;
  if public.current_user_role() is distinct from 'candidate' then
    raise exception 'apenas candidatos participam do banco de talentos' using errcode = '42501';
  end if;

  insert into public.resumes (profile_id, city_id)
  select uid, p.city_id from public.profiles p where p.id = uid
  on conflict (profile_id) do nothing;

  select talent_pool_status into previous from public.resumes where profile_id = uid;

  if new_status = 'active' and previous = 'none' and nullif(consent_version, '') is null then
    raise exception 'é preciso aceitar o termo do banco de talentos' using errcode = '22023';
  end if;

  update public.resumes
  set talent_pool_status = new_status,
      talent_pool_consent_version = case
        when new_status = 'active' and previous = 'none' then left(consent_version, 40)
        else talent_pool_consent_version
      end
  where profile_id = uid;

  -- Autorizar e retirar ficam no histórico de consentimentos; pausar não altera o consentimento.
  if (new_status = 'active' and previous = 'none') or (new_status = 'none' and previous <> 'none') then
    insert into public.consents (profile_id, purpose, granted, term_version)
    values (uid, 'talent_pool', new_status = 'active', coalesce(left(nullif(consent_version, ''), 40), 'retirada'));
  end if;

  update public.profiles set last_active_at = now() where id = uid;
  return new_status;
end;
$$;

revoke execute on function public.set_talent_pool(public.talent_pool_status, text) from public, anon;
grant execute on function public.set_talent_pool(public.talent_pool_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Busca e sugestão de talentos
-- Ordem: faixa de proximidade (1 mesma cidade, 2 dentro do raio, 3 mesmo estado, 4 resto do país,
-- 5 sem cidade; 0 quando não há referência de local, p. ex. vaga remota) e, dentro da faixa, aderência.
-- ---------------------------------------------------------------------------
create or replace function public.talent_search(
  target_job uuid default null,
  center_city integer default null,
  radius_km integer default null,
  area uuid default null,
  skill_ids uuid[] default null,
  min_education public.education_level default null,
  min_experience_months integer default null,
  query text default null,
  page_size integer default 20,
  page_offset integer default 0
)
returns table (
  resume_id uuid,
  display_name text,
  headline text,
  city_name text,
  uf text,
  area_name text,
  education_level public.education_level,
  experience_months integer,
  distance_km double precision,
  band smallint,
  score smallint,
  matched_required integer,
  total_required integer,
  matched_desired integer,
  total_desired integer,
  area_match boolean,
  education_match boolean,
  experience_match boolean,
  matched_skills text[],
  updated_at timestamptz,
  already_applied boolean,
  invite_status public.invite_status,
  saved boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  caller_company uuid;
  j_id uuid;
  j_company uuid;
  j_work_mode public.work_mode;
  j_city integer;
  j_region_mode public.region_mode;
  j_radius integer;
  j_area uuid;
  j_min_education public.education_level;
  j_min_experience integer;
  center integer;
  radius integer;
  restrict_region boolean := false;
  filter_by_radius boolean := center_city is not null;
  weights jsonb;
  w_required numeric;
  w_desired numeric;
  w_area numeric;
  w_experience numeric;
  w_education numeric;
  ts_query tsquery;
begin
  select m.company_id into caller_company
  from company_members m
  join companies c on c.id = m.company_id
  where m.profile_id = uid and c.status = 'approved';

  if caller_company is null and not public.is_admin() then
    raise exception 'o banco de talentos é liberado para empresas com cadastro aprovado' using errcode = '42501';
  end if;

  if target_job is not null then
    select j.id, j.company_id, j.work_mode, j.city_id, j.region_mode, j.radius_km, j.area_id, j.min_education, j.min_experience_months
    into j_id, j_company, j_work_mode, j_city, j_region_mode, j_radius, j_area, j_min_education, j_min_experience
    from jobs j where j.id = target_job;
    if j_id is null or (j_company is distinct from caller_company and not public.is_admin()) then
      raise exception 'vaga não encontrada' using errcode = 'P0002';
    end if;
    if j_work_mode <> 'remote' then
      center := coalesce(center_city, j_city);
      restrict_region := j_region_mode = 'restrict';
    end if;
  else
    center := center_city;
  end if;

  radius := coalesce(radius_km, j_radius, (select (value #>> '{}')::integer from app_settings where key = 'default_radius_km'), 30);
  weights := coalesce((select value from app_settings where key = 'matching_weights'), '{}'::jsonb);
  w_required := coalesce((weights ->> 'required_skills')::numeric, 40);
  w_desired := coalesce((weights ->> 'desired_skills')::numeric, 15);
  w_area := coalesce((weights ->> 'area')::numeric, 20);
  w_experience := coalesce((weights ->> 'experience')::numeric, 15);
  w_education := coalesce((weights ->> 'education')::numeric, 10);

  if nullif(trim(query), '') is not null then
    ts_query := websearch_to_tsquery('portuguese', public.immutable_unaccent(query));
  end if;

  return query
  with job_skill as (
    select js.skill_id, js.requirement from job_skills js where js.job_id = j_id
  ),
  candidates as (
    select
      r.id,
      p.full_name,
      r.headline,
      r.objective,
      r.city_id,
      r.area_id,
      r.education_level,
      r.updated_at,
      c.name as city_name,
      s.uf::text as uf,
      c.state_code,
      a.name as area_name,
      public.resume_experience_months(r.id) as experience_months,
      case when center is not null and c.id is not null
        then st_distance(c.location, cc.location) / 1000.0 end as distance_km,
      cc.state_code as center_state
    from resumes r
    join profiles p on p.id = r.profile_id and p.role = 'candidate' and p.blocked_at is null
    left join cities c on c.id = r.city_id
    left join states s on s.code = c.state_code
    left join areas a on a.id = r.area_id
    left join cities cc on cc.id = center
    where r.talent_pool_status = 'active'
      and (talent_search.area is null or r.area_id = talent_search.area)
      and (
        skill_ids is null or cardinality(skill_ids) = 0
        or (select count(distinct rs.skill_id) from resume_skills rs where rs.resume_id = r.id and rs.skill_id = any (skill_ids))
           = (select count(distinct x) from unnest(skill_ids) x)
      )
      and (
        talent_search.min_education is null
        or array_position(enum_range(null::education_level), r.education_level)
           >= array_position(enum_range(null::education_level), talent_search.min_education)
      )
      and (
        ts_query is null
        or to_tsvector('portuguese', public.immutable_unaccent(coalesce(r.headline, '') || ' ' || coalesce(r.objective, ''))) @@ ts_query
      )
  ),
  ranked as (
    select
      cand.*,
      (case
        when center is null then 0
        when cand.city_id is null then 5
        when cand.city_id = center then 1
        when cand.distance_km <= radius then 2
        when cand.state_code = cand.center_state then 3
        else 4
      end)::smallint as band,
      (select count(*) from job_skill js where js.requirement = 'required')::integer as total_required,
      (select count(*) from job_skill js join resume_skills rs on rs.skill_id = js.skill_id and rs.resume_id = cand.id
        where js.requirement = 'required')::integer as matched_required,
      (select count(*) from job_skill js where js.requirement = 'desired')::integer as total_desired,
      (select count(*) from job_skill js join resume_skills rs on rs.skill_id = js.skill_id and rs.resume_id = cand.id
        where js.requirement = 'desired')::integer as matched_desired,
      case when j_area is null then null else cand.area_id = j_area end as area_match,
      case when j_min_education is null then null
        else coalesce(array_position(enum_range(null::education_level), cand.education_level)
             >= array_position(enum_range(null::education_level), j_min_education), false) end as education_match,
      case when j_min_experience is null then null
        else cand.experience_months >= j_min_experience end as experience_match,
      array(
        select sk.name from resume_skills rs join skills sk on sk.id = rs.skill_id
        where rs.resume_id = cand.id and rs.skill_id in (select js.skill_id from job_skill js)
        order by sk.name
      ) as matched_skills
    from candidates cand
    where (talent_search.min_experience_months is null or cand.experience_months >= talent_search.min_experience_months)
  ),
  scored as (
    select
      rk.*,
      -- Aderência: média ponderada só dos critérios que a vaga define (pesos em app_settings).
      case when j_id is null then null else (
        select case when sum(w) = 0 then null else round(100 * sum(w * v) / sum(w))::smallint end
        from (values
          (case when rk.total_required > 0 then w_required else 0 end,
           case when rk.total_required > 0 then rk.matched_required::numeric / rk.total_required else 0 end),
          (case when rk.total_desired > 0 then w_desired else 0 end,
           case when rk.total_desired > 0 then rk.matched_desired::numeric / rk.total_desired else 0 end),
          (case when rk.area_match is not null then w_area else 0 end,
           case when rk.area_match then 1 else 0 end),
          (case when j_min_experience is not null and j_min_experience > 0 then w_experience else 0 end,
           least(1, rk.experience_months::numeric / greatest(j_min_experience, 1))),
          (case when rk.education_match is not null then w_education else 0 end,
           case when rk.education_match then 1 else 0 end)
        ) as criteria(w, v)
      ) end as score
    from ranked rk
    where (not restrict_region or rk.band in (1, 2))
      and (not filter_by_radius or rk.band in (1, 2))
  )
  select
    sc.id,
    public.short_name(sc.full_name),
    sc.headline,
    sc.city_name,
    sc.uf,
    sc.area_name,
    sc.education_level,
    sc.experience_months,
    round(sc.distance_km::numeric, 1)::double precision,
    sc.band,
    sc.score,
    sc.matched_required,
    sc.total_required,
    sc.matched_desired,
    sc.total_desired,
    sc.area_match,
    sc.education_match,
    sc.experience_match,
    sc.matched_skills,
    sc.updated_at,
    exists (select 1 from applications ap where ap.job_id = j_id and ap.resume_id = sc.id),
    (select ti.status from talent_invites ti where ti.job_id = j_id and ti.resume_id = sc.id),
    exists (select 1 from saved_resumes sr where sr.company_id = caller_company and sr.resume_id = sc.id),
    count(*) over ()
  from scored sc
  order by
    sc.band,
    sc.score desc nulls last,
    sc.distance_km asc nulls last,
    sc.updated_at desc
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
end;
$$;

revoke execute on function public.talent_search(uuid, integer, integer, uuid, uuid[], public.education_level, integer, text, integer, integer) from public, anon;
grant execute on function public.talent_search(uuid, integer, integer, uuid, uuid[], public.education_level, integer, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create or replace function public.talent_invites_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not exists (select 1 from public.jobs where id = new.job_id and status = 'published') then
      raise exception 'convites só podem ser enviados para vagas publicadas' using errcode = '42501';
    end if;
    if not exists (select 1 from public.resumes where id = new.resume_id and talent_pool_status = 'active') then
      raise exception 'currículo não está disponível no banco de talentos' using errcode = '42501';
    end if;
    if exists (select 1 from public.applications where job_id = new.job_id and resume_id = new.resume_id) then
      raise exception 'este candidato já se candidatou à vaga' using errcode = '23505';
    end if;
    new.invited_by := (select auth.uid());
    new.status := 'pending';
    new.responded_at := null;
    new.created_at := now();
    return new;
  end if;

  if new.job_id <> old.job_id or new.resume_id <> old.resume_id
     or new.invited_by is distinct from old.invited_by
     or new.message is distinct from old.message
     or new.created_at <> old.created_at then
    raise exception 'apenas a resposta do convite pode ser alterada' using errcode = '42501';
  end if;
  if new.status <> old.status then
    if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
      raise exception 'convite já respondido' using errcode = '42501';
    end if;
    new.responded_at := now();
  end if;
  return new;
end;
$$;

-- Aceite cria (ou marca) a candidatura com origem "convite".
create or replace function public.talent_invites_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.applications (job_id, resume_id, source)
    values (new.job_id, new.resume_id, 'invite')
    on conflict (job_id, resume_id) do update set source = 'invite';
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
  select j.title as job_title, j.slug as job_slug, c.trade_name as company_name, r.profile_id
  into info
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.resumes r on r.id = new.resume_id
  where j.id = new.job_id;

  perform public.queue_profile_notification(info.profile_id, 'talent_invite', jsonb_build_object(
    'invite_id', new.id, 'job_title', info.job_title, 'job_slug', info.job_slug,
    'company_name', info.company_name, 'message', new.message));
  return new;
end;
$$;

create trigger talent_invites_notify
  after insert on public.talent_invites
  for each row execute function public.talent_invites_notify();

-- Candidatura pelo link: se havia convite pendente para a vaga, ele é aceito junto
-- (o candidato responde às perguntas de triagem no mesmo fluxo).
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

  update public.talent_invites
  set status = 'accepted'
  where job_id = target_job and resume_id = candidate_resume and status = 'pending';

  update public.profiles set last_active_at = now() where id = uid;
  return application;
end;
$$;

-- ---------------------------------------------------------------------------
-- Favoritos e listas: saved_by preenchido pelo banco
-- ---------------------------------------------------------------------------
create or replace function public.saved_resumes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    new.saved_by := (select auth.uid());
    new.created_at := now();
  end if;
  new.list_name := trim(new.list_name);
  return new;
end;
$$;

create trigger saved_resumes_guard
  before insert on public.saved_resumes
  for each row execute function public.saved_resumes_guard();

-- Lista exige empresa aprovada (o currículo também precisa estar visível à empresa).
drop policy "saved_resumes: empresa salva currículo visível" on public.saved_resumes;
create policy "saved_resumes: empresa salva currículo visível" on public.saved_resumes for insert to authenticated
  with check (public.is_company_member(company_id) and public.is_approved_company_member() and public.can_view_resume(resume_id));
