-- Testes da Fase 1: CNPJ, usuários da empresa, salvar/duplicar vaga, moderação e avisos.
-- Usa as funções do schema test criadas em 01_foundation_test.sql.

\set ON_ERROR_STOP 1

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000101', 'dona@loja.test', '{"full_name": "Dona da Loja", "role": "company"}'),
  ('00000000-0000-0000-0000-000000000102', 'recrutador@loja.test', '{"full_name": "Recrutador", "role": "company"}'),
  ('00000000-0000-0000-0000-000000000103', 'outra@empresa.test', '{"full_name": "Outra Empresa", "role": "company"}'),
  ('00000000-0000-0000-0000-000000000104', 'candidato@loja.test', '{"full_name": "Candidato", "role": "candidate"}');

-- ---------------------------------------------------------------------------
-- CNPJ
-- ---------------------------------------------------------------------------
select test.check(public.is_valid_cnpj('11222333000181'), 'CNPJ numérico válido');
select test.check(public.is_valid_cnpj('12ABC34501DE35'), 'CNPJ alfanumérico válido (exemplo da Receita)');
select test.check(not public.is_valid_cnpj('11222333000182'), 'CNPJ com dígito errado é recusado');
select test.check(not public.is_valid_cnpj('00000000000000'), 'CNPJ com dígitos repetidos é recusado');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
select test.expect_error(
  $$insert into public.companies (cnpj, legal_name, trade_name) values ('12ABC34501DE36', 'Loja LTDA', 'Loja')$$,
  'companies_cnpj_valid'
);
-- INSERT ... RETURNING (usado pela API) precisa enxergar a empresa recém-criada.
insert into public.companies (cnpj, legal_name, trade_name, city_id)
values ('12.abc.345/01de-35', 'Loja Alfa LTDA', 'Loja Alfa', 3106200)
returning id;
select test.check(
  (select cnpj from public.companies where trade_name = 'Loja Alfa') = '12ABC34501DE35',
  'CNPJ é gravado sem pontuação e em maiúsculas'
);
select test.expect_error(
  $$insert into public.companies (cnpj, legal_name, trade_name) values ('33444555000181', 'Segunda LTDA', 'Segunda')$$,
  'já pertence'
);

-- ---------------------------------------------------------------------------
-- Usuários da empresa
-- ---------------------------------------------------------------------------
select test.expect_error(
  $$select public.add_company_member((select id from public.companies where trade_name = 'Loja Alfa'), 'candidato@loja.test')$$,
  'nenhuma conta de empresa'
);
select public.add_company_member((select id from public.companies where trade_name = 'Loja Alfa'), 'RECRUTADOR@loja.test');
select test.check(
  (select role from public.company_members where profile_id = '00000000-0000-0000-0000-000000000102') = 'recruiter',
  'administrador adiciona recrutador pelo e-mail'
);
select test.expect_error(
  $$select public.add_company_member((select id from public.companies where trade_name = 'Loja Alfa'), 'recrutador@loja.test')$$,
  'já pertence'
);
select test.expect_error(
  $$delete from public.company_members where profile_id = '00000000-0000-0000-0000-000000000101'$$,
  'ao menos um administrador'
);
select test.expect_error(
  $$update public.company_members set role = 'recruiter' where profile_id = '00000000-0000-0000-0000-000000000101'$$,
  'ao menos um administrador'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.expect_error(
  $$select public.add_company_member((select id from public.companies where trade_name = 'Loja Alfa'), 'outra@empresa.test')$$,
  'apenas administradores'
);
select test.check(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000101') = 1,
  'recrutador vê os colegas da empresa'
);

-- ---------------------------------------------------------------------------
-- Salvar vaga (recrutador)
-- ---------------------------------------------------------------------------
create temporary table saved as
select * from public.save_job(
  null,
  (select id from public.companies where trade_name = 'Loja Alfa'),
  '{"title": "Vendedor de Loja", "description": "Atendimento e vendas", "contract_type": "clt", "work_mode": "on_site",
    "city_id": "3106200", "salary_min": "2000", "salary_max": "2500", "benefits": ["Vale-transporte", "Comissão"],
    "positions": "2", "region_mode": "restrict", "radius_km": "20"}'::jsonb,
  (select jsonb_agg(jsonb_build_object('skill_id', id, 'requirement', case when slug = 'vendas' then 'required' else 'desired' end))
   from public.skills where slug in ('vendas', 'negociacao')),
  '[{"question": "Possui experiência com vendas?", "type": "yes_no"},
    {"question": "Qual turno prefere?", "type": "single_choice", "options": ["Manhã", "Tarde"], "is_required": false}]'::jsonb,
  false
);
grant select on saved to authenticated, anon;

select test.check((select job_status from saved) = 'draft', 'vaga salva como rascunho');
select test.check(
  (select count(*) from public.job_skills where job_id = (select job_id from saved)) = 2
  and (select requirement from public.job_skills js join public.skills s on s.id = js.skill_id
       where js.job_id = (select job_id from saved) and s.slug = 'negociacao') = 'desired',
  'habilidades exigidas e desejáveis gravadas'
);
select test.check(
  (select array_agg(question order by position) from public.job_questions where job_id = (select job_id from saved))
    = array['Possui experiência com vendas?', 'Qual turno prefere?'],
  'perguntas de triagem gravadas na ordem'
);
select test.check(
  (select benefits from public.jobs where id = (select job_id from saved)) = array['Vale-transporte', 'Comissão'],
  'benefícios gravados'
);

-- Edita: mantém a 1ª pergunta (com novo texto), remove a 2ª, cria outra e envia para análise.
select * from public.save_job(
  (select job_id from saved),
  null,
  '{"title": "Vendedor de Loja", "description": "Atendimento, vendas e caixa", "contract_type": "clt", "work_mode": "on_site", "city_id": "3106200"}'::jsonb,
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('id', (select id from public.job_questions where job_id = (select job_id from saved) and position = 1),
                       'question', 'Tem experiência em vendas?', 'type', 'yes_no'),
    jsonb_build_object('question', 'Possui CNH?', 'type', 'yes_no')
  ),
  true
);
select test.check(
  (select status from public.jobs where id = (select job_id from saved)) = 'in_review'
  and (select submitted_at from public.jobs where id = (select job_id from saved)) is not null,
  'envio para análise registra a data'
);
select test.check(
  (select array_agg(question order by position) from public.job_questions where job_id = (select job_id from saved))
    = array['Tem experiência em vendas?', 'Possui CNH?'],
  'perguntas atualizadas, removidas e criadas'
);
select test.check(
  (select count(*) from public.job_skills where job_id = (select job_id from saved)) = 0,
  'habilidades substituídas pela nova lista'
);

create temporary table duplicated as select public.duplicate_job((select job_id from saved)) as id;
select test.check(
  (select status from public.jobs where id = (select id from duplicated)) = 'draft',
  'vaga duplicada nasce como rascunho'
);
select test.check(
  (select count(*) from public.job_questions q join public.jobs j on j.id = q.job_id where j.title = 'Vendedor de Loja (cópia)') = 2,
  'cópia leva as perguntas de triagem'
);

-- Outra empresa não altera nem duplica a vaga
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
select test.expect_error(
  $$select * from public.save_job((select job_id from saved), null, '{"title": "Invasão", "contract_type": "clt", "work_mode": "remote"}'::jsonb)$$,
  'não encontrada'
);
select test.expect_error($$select public.duplicate_job((select job_id from saved))$$, 'não encontrada');

-- ---------------------------------------------------------------------------
-- Aprovação da empresa e moderação geram avisos
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.companies set status = 'rejected', status_reason = 'Razão social diferente da Receita' where trade_name = 'Loja Alfa';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
update public.companies set legal_name = 'Loja Alfa Comércio LTDA' where trade_name = 'Loja Alfa';
select test.check(
  (select status from public.companies where trade_name = 'Loja Alfa') = 'pending',
  'empresa reprovada volta para análise ao corrigir os dados'
);
select test.check(
  (select count(*) from public.notifications where template = 'company_reviewed') = 1,
  'administrador da empresa recebe aviso da reprovação'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.companies set status = 'approved', status_reason = null where trade_name = 'Loja Alfa';
insert into public.job_moderation (job_id, decision, reason)
values ((select job_id from saved), 'changes_requested', 'Informe o horário de trabalho');
select test.check(
  (select status from public.jobs where id = (select job_id from saved)) = 'draft',
  'pedido de ajuste devolve a vaga para rascunho'
);
insert into public.job_moderation (job_id, decision) values ((select job_id from saved), 'approved');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
select test.check(
  (select count(*) from public.notifications where template = 'job_moderated') = 2
  and (select count(*) from public.notifications where template = 'job_moderated' and payload ->> 'reason' = 'Informe o horário de trabalho') = 1,
  'cada decisão de moderação gera aviso com o motivo'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select count(*) from public.notifications) = 0,
  'recrutador não recebe avisos destinados ao administrador'
);

-- ---------------------------------------------------------------------------
-- Visualizações e aviso de encerramento
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.register_job_view((select job_id from saved), 'whatsapp');
select public.register_job_view((select job_id from saved), 'whatsapp');
select public.register_job_view((select job_id from saved), 'qrcode');

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
select test.check(
  (select total from public.job_view_counts(array[(select job_id from saved)]) where source = 'whatsapp') = 2,
  'contagem de visualizações por origem'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', false);
select test.check(
  (select count(*) from public.job_view_counts(array[(select job_id from saved)])) = 0,
  'outra empresa não vê as visualizações'
);

reset role;
update public.jobs set closes_at = (now() at time zone 'America/Sao_Paulo')::date + 3 where id = (select job_id from saved);
select test.check(public.queue_job_closing_reminders() = 1, 'aviso de encerramento em 3 dias enfileirado');
select test.check(public.queue_job_closing_reminders() = 0, 'aviso de encerramento não se repete');

\echo
