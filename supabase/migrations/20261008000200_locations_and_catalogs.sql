-- Trivagas · Fase 0 · Regiões, estados, cidades (IBGE) e catálogos

create table public.regions (
  id smallint primary key,
  name text not null unique
);

create table public.states (
  code smallint primary key,            -- código IBGE da UF
  uf char(2) not null unique,
  name text not null,
  region_id smallint not null references public.regions (id)
);

create table public.cities (
  id integer primary key,               -- código IBGE do município (7 dígitos)
  name text not null,
  state_code smallint not null references public.states (code),
  latitude double precision not null,
  longitude double precision not null,
  is_capital boolean not null default false,
  location extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored
);

create index cities_state_code_idx on public.cities (state_code);
create index cities_location_idx on public.cities using gist (location);
create index cities_name_search_idx on public.cities
  using gin ((lower(public.immutable_unaccent(name))) extensions.gin_trgm_ops);

-- Busca de cidades para autocompletar (ignora acentos e maiúsculas).
create or replace function public.search_cities(query text, uf_filter text default null, max_results integer default 10)
returns table (id integer, name text, uf char(2), label text)
language sql
stable
set search_path = public, extensions
as $$
  with q as (select lower(public.immutable_unaccent(trim(query))) as term)
  select c.id, c.name, s.uf, c.name || ' - ' || s.uf as label
  from public.cities c
  join public.states s on s.code = c.state_code
  cross join q
  where length(q.term) >= 2
    and lower(public.immutable_unaccent(c.name)) like '%' || q.term || '%'
    and (uf_filter is null or s.uf = upper(uf_filter))
  order by
    (lower(public.immutable_unaccent(c.name)) = q.term) desc,
    (lower(public.immutable_unaccent(c.name)) like q.term || '%') desc,
    c.is_capital desc,
    c.name
  limit least(greatest(max_results, 1), 50);
$$;

-- Distância em km entre duas cidades (null se alguma não existir).
create or replace function public.city_distance_km(city_a integer, city_b integer)
returns double precision
language sql
stable
set search_path = public, extensions
as $$
  select extensions.st_distance(a.location, b.location) / 1000.0
  from public.cities a, public.cities b
  where a.id = city_a and b.id = city_b;
$$;

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  area_id uuid references public.areas (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index skills_area_id_idx on public.skills (area_id);
create index skills_name_search_idx on public.skills
  using gin ((lower(public.immutable_unaccent(name))) extensions.gin_trgm_ops);

-- Configurações ajustáveis pelo administrador (pesos de aderência, raio padrão, versões dos termos...).
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.regions (id, name) values
  (1, 'Norte'), (2, 'Nordeste'), (3, 'Sudeste'), (4, 'Sul'), (5, 'Centro-Oeste');

insert into public.app_settings (key, value, description) values
  ('matching_weights',
   '{"required_skills": 40, "desired_skills": 15, "area": 20, "experience": 15, "education": 10}',
   'Pesos (soma 100) usados no cálculo de aderência entre vaga e currículo'),
  ('default_radius_km', '30', 'Raio de proximidade padrão, em km, para vagas e buscas'),
  ('resume_retention_months', '6', 'Meses de inatividade antes da remoção definitiva do currículo'),
  ('terms_version', '"2026-10-08"', 'Versão vigente dos termos de uso'),
  ('privacy_version', '"2026-10-08"', 'Versão vigente da política de privacidade'),
  ('talent_pool_terms_version', '"2026-10-08"', 'Versão vigente do termo de participação no banco de talentos');

insert into public.areas (name, slug) values
  ('Administrativo', 'administrativo'),
  ('Atendimento ao cliente', 'atendimento-ao-cliente'),
  ('Comercial e vendas', 'comercial-e-vendas'),
  ('Comunicação e marketing', 'comunicacao-e-marketing'),
  ('Construção civil', 'construcao-civil'),
  ('Educação', 'educacao'),
  ('Engenharia', 'engenharia'),
  ('Financeiro e contábil', 'financeiro-e-contabil'),
  ('Gastronomia', 'gastronomia'),
  ('Indústria e produção', 'industria-e-producao'),
  ('Jurídico', 'juridico'),
  ('Logística e transporte', 'logistica-e-transporte'),
  ('Manutenção', 'manutencao'),
  ('Recursos humanos', 'recursos-humanos'),
  ('Saúde', 'saude'),
  ('Segurança', 'seguranca'),
  ('Serviços gerais e limpeza', 'servicos-gerais-e-limpeza'),
  ('Tecnologia da informação', 'tecnologia-da-informacao'),
  ('Varejo', 'varejo'),
  ('Agronegócio', 'agronegocio');

insert into public.skills (name, slug) values
  ('Pacote Office', 'pacote-office'),
  ('Excel avançado', 'excel-avancado'),
  ('Atendimento ao público', 'atendimento-ao-publico'),
  ('Vendas', 'vendas'),
  ('Negociação', 'negociacao'),
  ('Comunicação', 'comunicacao'),
  ('Trabalho em equipe', 'trabalho-em-equipe'),
  ('Liderança', 'lideranca'),
  ('Organização', 'organizacao'),
  ('Rotinas administrativas', 'rotinas-administrativas'),
  ('Contas a pagar e receber', 'contas-a-pagar-e-receber'),
  ('Departamento pessoal', 'departamento-pessoal'),
  ('Operação de caixa', 'operacao-de-caixa'),
  ('Estoque', 'estoque'),
  ('Empilhadeira', 'empilhadeira'),
  ('CNH B', 'cnh-b'),
  ('CNH D', 'cnh-d'),
  ('Inglês', 'ingles'),
  ('Espanhol', 'espanhol'),
  ('Redes sociais', 'redes-sociais'),
  ('JavaScript', 'javascript'),
  ('Python', 'python'),
  ('SQL', 'sql'),
  ('Suporte técnico', 'suporte-tecnico'),
  ('Cozinha', 'cozinha'),
  ('Limpeza', 'limpeza'),
  ('Elétrica', 'eletrica'),
  ('Mecânica', 'mecanica'),
  ('Primeiros socorros', 'primeiros-socorros'),
  ('Telemarketing', 'telemarketing');
