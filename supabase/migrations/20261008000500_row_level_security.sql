-- Trivagas · Fase 0 · Row Level Security
-- Cada empresa enxerga só suas vagas e candidatos; cada candidato só o próprio currículo.

alter table public.regions enable row level security;
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.areas enable row level security;
alter table public.skills enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.job_questions enable row level security;
alter table public.resumes enable row level security;
alter table public.resume_experiences enable row level security;
alter table public.resume_education enable row level security;
alter table public.resume_skills enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.application_notes enable row level security;
alter table public.talent_invites enable row level security;
alter table public.saved_resumes enable row level security;
alter table public.job_moderation enable row level security;
alter table public.job_reports enable row level security;
alter table public.job_views enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.consents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Catálogos: leitura pública, escrita do administrador
-- ---------------------------------------------------------------------------
create policy "regions: leitura pública" on public.regions for select to anon, authenticated using (true);
create policy "states: leitura pública" on public.states for select to anon, authenticated using (true);
create policy "cities: leitura pública" on public.cities for select to anon, authenticated using (true);

create policy "areas: leitura pública" on public.areas for select to anon, authenticated using (true);
create policy "areas: admin gerencia" on public.areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "skills: leitura pública" on public.skills for select to anon, authenticated using (true);
create policy "skills: admin gerencia" on public.skills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "app_settings: leitura pública" on public.app_settings for select to anon, authenticated using (true);
create policy "app_settings: admin gerencia" on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "plans: leitura pública" on public.plans for select to anon, authenticated using (active or public.is_admin());
create policy "plans: admin gerencia" on public.plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create policy "profiles: leitura conforme vínculo" on public.profiles for select to authenticated
  using (public.can_view_profile(id));
create policy "profiles: usuário edita o próprio" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
create policy "companies: aprovadas são públicas" on public.companies for select to anon, authenticated
  using (status = 'approved' or public.is_company_member(id) or public.is_admin());
create policy "companies: usuário empresa cadastra" on public.companies for insert to authenticated
  with check (public.current_user_role() in ('company', 'admin'));
create policy "companies: administrador da empresa edita" on public.companies for update to authenticated
  using (public.is_company_admin(id) or public.is_admin())
  with check (public.is_company_admin(id) or public.is_admin());
create policy "companies: admin exclui" on public.companies for delete to authenticated
  using (public.is_admin());

create policy "company_members: colegas e admin leem" on public.company_members for select to authenticated
  using (public.is_company_member(company_id) or public.is_admin());
create policy "company_members: administrador da empresa adiciona" on public.company_members for insert to authenticated
  with check (public.is_company_admin(company_id) or public.is_admin());
create policy "company_members: administrador da empresa altera" on public.company_members for update to authenticated
  using (public.is_company_admin(company_id) or public.is_admin())
  with check (public.is_company_admin(company_id) or public.is_admin());
create policy "company_members: administrador remove ou usuário sai" on public.company_members for delete to authenticated
  using (public.is_company_admin(company_id) or profile_id = (select auth.uid()) or public.is_admin());

create policy "subscriptions: empresa e admin leem" on public.subscriptions for select to authenticated
  using (public.is_company_member(company_id) or public.is_admin());
create policy "subscriptions: admin gerencia" on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Vagas
-- ---------------------------------------------------------------------------
create policy "jobs: publicadas são públicas" on public.jobs for select to anon, authenticated
  using (status = 'published' or public.can_view_job(id));
create policy "jobs: empresa cria" on public.jobs for insert to authenticated
  with check (public.is_company_member(company_id) or public.is_admin());
create policy "jobs: empresa edita" on public.jobs for update to authenticated
  using (public.is_company_member(company_id) or public.is_admin())
  with check (public.is_company_member(company_id) or public.is_admin());
create policy "jobs: rascunho pode ser excluído" on public.jobs for delete to authenticated
  using ((status = 'draft' and public.is_company_member(company_id)) or public.is_admin());

create policy "job_skills: segue a vaga" on public.job_skills for select to anon, authenticated
  using (public.can_view_job(job_id));
create policy "job_skills: empresa gerencia" on public.job_skills for all to authenticated
  using (public.is_job_member(job_id) or public.is_admin())
  with check (public.is_job_member(job_id) or public.is_admin());

create policy "job_questions: segue a vaga" on public.job_questions for select to anon, authenticated
  using (public.can_view_job(job_id));
create policy "job_questions: empresa gerencia" on public.job_questions for all to authenticated
  using (public.is_job_member(job_id) or public.is_admin())
  with check (public.is_job_member(job_id) or public.is_admin());

create policy "job_moderation: empresa e admin leem" on public.job_moderation for select to authenticated
  using (public.is_job_member(job_id) or public.is_admin());
create policy "job_moderation: admin decide" on public.job_moderation for insert to authenticated
  with check (public.is_admin());

create policy "job_reports: qualquer pessoa denuncia vaga publicada" on public.job_reports for insert to anon, authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.status = 'published'));
create policy "job_reports: admin lê" on public.job_reports for select to authenticated
  using (public.is_admin());
create policy "job_reports: admin trata" on public.job_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "job_views: empresa e admin leem" on public.job_views for select to authenticated
  using (public.is_job_member(job_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Currículos
-- ---------------------------------------------------------------------------
create policy "resumes: leitura conforme consentimento" on public.resumes for select to authenticated
  using (public.can_view_resume(id));
create policy "resumes: candidato cria o próprio" on public.resumes for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "resumes: candidato edita o próprio" on public.resumes for update to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());
create policy "resumes: candidato exclui o próprio" on public.resumes for delete to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy "resume_experiences: leitura conforme currículo" on public.resume_experiences for select to authenticated
  using (public.can_view_resume(resume_id));
create policy "resume_experiences: dono gerencia" on public.resume_experiences for all to authenticated
  using (public.owns_resume(resume_id)) with check (public.owns_resume(resume_id));

create policy "resume_education: leitura conforme currículo" on public.resume_education for select to authenticated
  using (public.can_view_resume(resume_id));
create policy "resume_education: dono gerencia" on public.resume_education for all to authenticated
  using (public.owns_resume(resume_id)) with check (public.owns_resume(resume_id));

create policy "resume_skills: leitura conforme currículo" on public.resume_skills for select to authenticated
  using (public.can_view_resume(resume_id));
create policy "resume_skills: dono gerencia" on public.resume_skills for all to authenticated
  using (public.owns_resume(resume_id)) with check (public.owns_resume(resume_id));

-- ---------------------------------------------------------------------------
-- Candidaturas
-- ---------------------------------------------------------------------------
create policy "applications: candidato, empresa e admin leem" on public.applications for select to authenticated
  using (public.owns_resume(resume_id) or public.is_job_member(job_id) or public.is_admin());
create policy "applications: candidato se candidata" on public.applications for insert to authenticated
  with check (public.owns_resume(resume_id));
create policy "applications: empresa avalia" on public.applications for update to authenticated
  using (public.is_job_member(job_id) or public.is_admin())
  with check (public.is_job_member(job_id) or public.is_admin());
create policy "applications: candidato desiste" on public.applications for delete to authenticated
  using (public.owns_resume(resume_id) or public.is_admin());

create policy "application_answers: candidato, empresa e admin leem" on public.application_answers for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (public.owns_resume(a.resume_id) or public.is_job_member(a.job_id) or public.is_admin())
  ));
create policy "application_answers: candidato responde" on public.application_answers for insert to authenticated
  with check (exists (
    select 1 from public.applications a
    join public.job_questions q on q.id = question_id and q.job_id = a.job_id
    where a.id = application_id and public.owns_resume(a.resume_id)
  ));

create policy "application_notes: empresa lê" on public.application_notes for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and (public.is_job_member(a.job_id) or public.is_admin())
  ));
create policy "application_notes: empresa anota" on public.application_notes for insert to authenticated
  with check (exists (
    select 1 from public.applications a
    where a.id = application_id and public.is_job_member(a.job_id)
  ));
create policy "application_notes: autor edita" on public.application_notes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "application_notes: autor exclui" on public.application_notes for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Banco de talentos
-- ---------------------------------------------------------------------------
create policy "talent_invites: candidato e empresa leem" on public.talent_invites for select to authenticated
  using (public.owns_resume(resume_id) or public.is_job_member(job_id) or public.is_admin());
create policy "talent_invites: empresa convida" on public.talent_invites for insert to authenticated
  with check (public.is_job_member(job_id) and public.is_approved_company_member());
create policy "talent_invites: candidato responde" on public.talent_invites for update to authenticated
  using (public.owns_resume(resume_id)) with check (public.owns_resume(resume_id));
create policy "talent_invites: empresa cancela pendente" on public.talent_invites for delete to authenticated
  using (status = 'pending' and public.is_job_member(job_id));

create policy "saved_resumes: empresa gerencia" on public.saved_resumes for select to authenticated
  using (public.is_company_member(company_id));
create policy "saved_resumes: empresa salva currículo visível" on public.saved_resumes for insert to authenticated
  with check (public.is_company_member(company_id) and public.can_view_resume(resume_id));
create policy "saved_resumes: empresa remove" on public.saved_resumes for delete to authenticated
  using (public.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- LGPD
-- ---------------------------------------------------------------------------
create policy "consents: titular e admin leem" on public.consents for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "consents: titular registra" on public.consents for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "notifications: destinatário e admin leem" on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

create policy "audit_log: admin lê" on public.audit_log for select to authenticated
  using (public.is_admin());

-- Funções internas não devem ser chamadas diretamente pela API.
revoke execute on function public.close_expired_jobs() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
