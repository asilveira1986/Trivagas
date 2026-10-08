-- Trivagas · Fase 0 · Extensões e tipos enumerados

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() não é imutável; este invólucro permite usá-lo em índices e colunas geradas.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(public.immutable_unaccent(value)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Atualiza updated_at em qualquer tabela que tenha a coluna.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create type public.user_role as enum ('candidate', 'company', 'admin');
create type public.company_status as enum ('pending', 'approved', 'rejected', 'blocked');
create type public.company_member_role as enum ('admin', 'recruiter');
create type public.company_size as enum ('mei', 'micro', 'small', 'medium', 'large');
create type public.contract_type as enum ('clt', 'pj', 'internship', 'temporary');
create type public.work_mode as enum ('on_site', 'hybrid', 'remote');
create type public.job_status as enum ('draft', 'in_review', 'published', 'paused', 'closed', 'rejected');
create type public.region_mode as enum ('restrict', 'prioritize');
create type public.skill_requirement as enum ('required', 'desired');
create type public.skill_level as enum ('basic', 'intermediate', 'advanced');
create type public.education_level as enum (
  'elementary', 'high_school', 'technical', 'undergraduate', 'postgraduate', 'masters', 'doctorate'
);
create type public.question_type as enum ('yes_no', 'short_text', 'single_choice');
create type public.application_stage as enum ('new', 'reviewing', 'interview', 'approved', 'rejected');
create type public.application_source as enum ('link', 'search', 'invite');
create type public.talent_pool_status as enum ('none', 'active', 'paused');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');
create type public.moderation_decision as enum ('approved', 'rejected', 'changes_requested');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.consent_purpose as enum ('terms_of_use', 'privacy_policy', 'application', 'talent_pool');
create type public.notification_status as enum ('queued', 'sent', 'failed');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
