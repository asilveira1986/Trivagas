-- Trivagas · Fase 0 · Funções de acesso e regras de negócio aplicadas no banco

-- ---------------------------------------------------------------------------
-- Funções auxiliares de acesso (security definer para evitar recursão de RLS)
-- ---------------------------------------------------------------------------

-- Verdadeiro quando a operação não vem de um usuário final (service_role, postgres,
-- ou funções security definer do próprio banco). Usada pelos gatilhos de proteção.
create or replace function public.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated');
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and blocked_at is null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and blocked_at is null
  );
$$;

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.profiles p on p.id = m.profile_id
    where m.company_id = target_company
      and m.profile_id = (select auth.uid())
      and p.blocked_at is null
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.profiles p on p.id = m.profile_id
    where m.company_id = target_company
      and m.profile_id = (select auth.uid())
      and m.role = 'admin'
      and p.blocked_at is null
  );
$$;

create or replace function public.is_approved_company_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = (select auth.uid())
      and c.status = 'approved'
      and p.blocked_at is null
  );
$$;

create or replace function public.is_job_member(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    join public.company_members m on m.company_id = j.company_id
    join public.profiles p on p.id = m.profile_id
    where j.id = target_job
      and m.profile_id = (select auth.uid())
      and p.blocked_at is null
  );
$$;

create or replace function public.owns_resume(target_resume uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resumes where id = target_resume and profile_id = (select auth.uid())
  );
$$;

-- A vaga é visível se publicada, se o usuário é da empresa, se é admin,
-- ou se o candidato tem candidatura ou convite para ela.
create or replace function public.can_view_job(target_job uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.jobs where id = target_job and status = 'published')
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

-- Currículo visível ao dono, ao admin, às empresas das vagas em que ele se candidatou
-- e, no banco de talentos, a membros de empresas aprovadas.
create or replace function public.can_view_resume(target_resume uuid)
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
    )
    or (
      exists (select 1 from public.resumes where id = target_resume and talent_pool_status = 'active')
      and public.is_approved_company_member()
    );
$$;

-- Dados de contato (perfil) liberados ao próprio usuário, ao admin, a colegas de empresa
-- e às empresas que receberam candidatura (inclusive por convite aceito).
create or replace function public.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.company_members mine
      join public.company_members theirs on theirs.company_id = mine.company_id
      where mine.profile_id = (select auth.uid()) and theirs.profile_id = target_profile
    )
    or exists (
      select 1
      from public.resumes r
      join public.applications a on a.resume_id = r.id
      join public.jobs j on j.id = a.job_id
      join public.company_members m on m.company_id = j.company_id
      where r.profile_id = target_profile and m.profile_id = (select auth.uid())
    );
$$;

-- ---------------------------------------------------------------------------
-- Endereços amigáveis
-- ---------------------------------------------------------------------------
-- security definer: a checagem de unicidade precisa enxergar linhas que o RLS esconde do usuário.
create or replace function public.unique_slug(base text, target_table regclass)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  root text := left(coalesce(nullif(public.slugify(base), ''), 'item'), 60);
  candidate text;
  taken boolean;
begin
  if target_table not in ('public.companies'::regclass, 'public.jobs'::regclass) then
    raise exception 'tabela não suportada: %', target_table;
  end if;
  root := trim(both '-' from root);
  loop
    candidate := root || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
    execute format('select exists (select 1 from %s where slug = $1)', target_table) into taken using candidate;
    exit when not taken;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis: papel e bloqueio só mudam pelo admin
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() or public.is_admin() then
    return new;
  end if;
  if new.id <> old.id then
    raise exception 'id do perfil não pode ser alterado' using errcode = '42501';
  end if;
  if new.role <> old.role then
    raise exception 'papel do usuário só pode ser alterado pelo administrador' using errcode = '42501';
  end if;
  if new.blocked_at is distinct from old.blocked_at then
    raise exception 'bloqueio só pode ser alterado pelo administrador' using errcode = '42501';
  end if;
  new.email := old.email;
  new.onboarded_at := old.onboarded_at;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Conclui o cadastro de quem entrou sem escolher perfil (ex.: Google). Só funciona uma vez.
create or replace function public.complete_onboarding(
  chosen_role public.user_role,
  chosen_name text,
  chosen_city integer,
  chosen_phone text,
  accepted_terms_version text,
  accepted_privacy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean_phone text := nullif(regexp_replace(coalesce(chosen_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if uid is null then
    raise exception 'usuário não autenticado' using errcode = '42501';
  end if;
  if chosen_role not in ('candidate', 'company') then
    raise exception 'perfil inválido' using errcode = '22023';
  end if;
  if nullif(trim(chosen_name), '') is null then
    raise exception 'informe o nome' using errcode = '22023';
  end if;
  if nullif(accepted_terms_version, '') is null or nullif(accepted_privacy_version, '') is null then
    raise exception 'é preciso aceitar os termos de uso e a política de privacidade' using errcode = '22023';
  end if;

  update public.profiles
  set role = chosen_role,
      full_name = left(trim(chosen_name), 120),
      city_id = chosen_city,
      phone = clean_phone,
      onboarded_at = now()
  where id = uid and onboarded_at is null;

  if not found then
    raise exception 'cadastro já concluído' using errcode = '42501';
  end if;

  insert into public.consents (profile_id, purpose, granted, term_version)
  values
    (uid, 'terms_of_use', true, left(accepted_terms_version, 40)),
    (uid, 'privacy_policy', true, left(accepted_privacy_version, 40));
end;
$$;

revoke execute on function public.complete_onboarding(public.user_role, text, integer, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(public.user_role, text, integer, text, text, text) to authenticated;

-- Registra atividade (usado na política de retenção de 6 meses).
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now() where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Empresas: aprovação só pelo admin; criador vira administrador da empresa
-- ---------------------------------------------------------------------------
create or replace function public.companies_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acting_admin boolean := public.is_admin();
begin
  if tg_op = 'INSERT' then
    if new.slug is null or new.slug = '' then
      new.slug := public.unique_slug(new.trade_name, 'public.companies');
    end if;
    if not public.is_privileged() and not acting_admin then
      if public.current_user_role() is distinct from 'company' then
        raise exception 'apenas usuários do tipo empresa podem cadastrar empresas' using errcode = '42501';
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
  -- Mudança de CNPJ ou razão social exige nova validação.
  if (new.cnpj is distinct from old.cnpj or new.legal_name is distinct from old.legal_name)
     and old.status = 'approved' then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

create trigger companies_guard
  before insert or update on public.companies
  for each row execute function public.companies_guard();

create or replace function public.companies_add_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, profile_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger companies_add_creator
  after insert on public.companies
  for each row execute function public.companies_add_creator();

-- ---------------------------------------------------------------------------
-- Vagas: ciclo de vida e moderação
-- ---------------------------------------------------------------------------
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

create trigger jobs_guard
  before insert or update on public.jobs
  for each row execute function public.jobs_guard();

-- O registro de moderação aplica a decisão na vaga.
create or replace function public.job_moderation_before()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    new.moderator_id := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger job_moderation_before
  before insert on public.job_moderation
  for each row execute function public.job_moderation_before();

create or replace function public.job_moderation_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs
  set status = case new.decision
      when 'approved' then 'published'::public.job_status
      when 'rejected' then 'rejected'::public.job_status
      else 'draft'::public.job_status
    end
  where id = new.job_id;
  return new;
end;
$$;

create trigger job_moderation_apply
  after insert on public.job_moderation
  for each row execute function public.job_moderation_apply();

-- Encerramento automático (agendado com pg_cron na Fase 1).
create or replace function public.close_expired_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.jobs
  set status = 'closed'
  where status in ('published', 'paused')
    and closes_at is not null
    and closes_at < (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- Currículos e consentimento do banco de talentos
-- ---------------------------------------------------------------------------
create or replace function public.resumes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      new.profile_id := (select auth.uid());
    elsif new.profile_id <> old.profile_id then
      raise exception 'dono do currículo não pode ser alterado' using errcode = '42501';
    end if;
  end if;

  if new.talent_pool_status = 'active'
     and (tg_op = 'INSERT' or old.talent_pool_status <> 'active') then
    if nullif(new.talent_pool_consent_version, '') is null then
      raise exception 'entrada no banco de talentos exige a versão do termo aceito' using errcode = '23514';
    end if;
    new.talent_pool_consent_at := now();
  end if;
  return new;
end;
$$;

create trigger resumes_guard
  before insert or update on public.resumes
  for each row execute function public.resumes_guard();

create or replace function public.consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    new.profile_id := (select auth.uid());
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger consents_guard
  before insert on public.consents
  for each row execute function public.consents_guard();

-- ---------------------------------------------------------------------------
-- Candidaturas
-- ---------------------------------------------------------------------------
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
    if not exists (select 1 from public.jobs where id = new.job_id and status = 'published') then
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

create trigger applications_guard
  before insert or update on public.applications
  for each row execute function public.applications_guard();

create or replace function public.application_notes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      new.author_id := (select auth.uid());
      new.created_at := now();
    elsif new.author_id is distinct from old.author_id or new.application_id <> old.application_id then
      raise exception 'autor da anotação não pode ser alterado' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger application_notes_guard
  before insert or update on public.application_notes
  for each row execute function public.application_notes_guard();

-- ---------------------------------------------------------------------------
-- Convites do banco de talentos
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

create trigger talent_invites_guard
  before insert or update on public.talent_invites
  for each row execute function public.talent_invites_guard();

-- Convite aceito vira candidatura com origem "convite" (libera o contato à empresa).
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
    on conflict (job_id, resume_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger talent_invites_accept
  after update on public.talent_invites
  for each row execute function public.talent_invites_accept();

-- ---------------------------------------------------------------------------
-- Denúncias, visualizações e auditoria
-- ---------------------------------------------------------------------------
create or replace function public.job_reports_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() or public.is_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and new.status in ('resolved', 'dismissed') then
      new.resolved_by := coalesce((select auth.uid()), new.resolved_by);
      new.resolved_at := now();
    end if;
    return new;
  end if;
  new.reporter_id := (select auth.uid());
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.created_at := now();
  return new;
end;
$$;

create trigger job_reports_guard
  before insert or update on public.job_reports
  for each row execute function public.job_reports_guard();

-- Registra uma visualização do link público (só para vagas publicadas).
create or replace function public.register_job_view(target_job uuid, view_source text default 'direct', view_referrer text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_views (job_id, source, referrer)
  select j.id, left(coalesce(nullif(lower(view_source), ''), 'direct'), 40), left(view_referrer, 500)
  from public.jobs j
  where j.id = target_job and j.status = 'published';
end;
$$;

-- Registra acesso ou alteração de dados pessoais.
create or replace function public.log_audit(audit_action text, audit_entity text, audit_entity_id text default null, audit_metadata jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  select (select auth.uid()), left(audit_action, 60), left(audit_entity, 60), left(audit_entity_id, 100), coalesce(audit_metadata, '{}'::jsonb)
  where (select auth.uid()) is not null;
$$;
