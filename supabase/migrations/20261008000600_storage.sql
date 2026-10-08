-- Trivagas · Fase 0 · Armazenamento de arquivos
-- resumes: privado, PDF até 5 MB, caminho "<profile_id>/<arquivo>.pdf"; entregue por link temporário.
-- logos:   público, imagens até 1 MB, caminho "<company_id>/<arquivo>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resumes', 'resumes', false, 5242880, array['application/pdf']),
  ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Currículo em PDF: o dono gerencia; empresas com acesso ao currículo podem ler
-- (necessário para gerar o link temporário de download).
create policy "resumes bucket: dono lê" on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.resumes r
        where r.pdf_path = name and public.can_view_resume(r.id)
      )
    )
  );

create policy "resumes bucket: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes bucket: dono substitui" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes bucket: dono exclui" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Logotipos: leitura pública pelo bucket; escrita pelo administrador da empresa.
create policy "logos bucket: administrador da empresa envia" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.companies c
      where c.id::text = (storage.foldername(name))[1] and public.is_company_admin(c.id)
    )
  );

create policy "logos bucket: administrador da empresa substitui" on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.companies c
      where c.id::text = (storage.foldername(name))[1] and public.is_company_admin(c.id)
    )
  );

create policy "logos bucket: administrador da empresa exclui" on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.companies c
      where c.id::text = (storage.foldername(name))[1] and public.is_company_admin(c.id)
    )
  );

create policy "logos bucket: leitura" on storage.objects for select to anon, authenticated
  using (bucket_id = 'logos');
