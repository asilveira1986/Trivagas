# Trivagas

Portal de anúncio de vagas: a empresa cadastra a vaga, compartilha um link público e acompanha as candidaturas; os currículos formam um banco de talentos consultado por região e aderência. Escopo completo em [`docs/escopo.md`](docs/escopo.md).

**Situação:** Fases 0 (Fundação) e 1 (Empresa e vagas) concluídas no código. Falta criar os projetos Supabase/Vercel e publicar (passo a passo abaixo).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Aplicação | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + componentes no padrão shadcn/ui |
| Banco, autenticação e arquivos | Supabase (PostgreSQL + PostGIS, Auth, Storage) com RLS |
| Hospedagem | Vercel |

## Estrutura

```
src/
  app/                    rotas (páginas públicas, /entrar, /cadastro, /boas-vindas, áreas /candidato, /empresa, /admin)
  app/auth/               retorno do Google/link mágico (callback), confirmação por token (confirm) e saída (sair)
  components/             interface (ui/ segue o padrão shadcn/ui; brand/ tem o símbolo provisório)
  lib/auth.ts             leitura do perfil logado e exigência de papel (requireRole)
  lib/supabase/           clientes do Supabase para navegador, servidor e proxy
  proxy.ts                renova a sessão e protege as áreas logadas
supabase/
  migrations/             tabelas, regras de negócio, RLS, storage e carga de estados/municípios do IBGE
  tests/                  testes de RLS e regras (rodam num PostgreSQL comum com PostGIS)
scripts/
  generate-cities-migration.mjs   regenera a carga de municípios do IBGE
  test-db.sh                      aplica as migrações e roda os testes de banco
```

## O que a Fase 0 entrega

- **Banco completo do escopo (seção 7)**: todas as tabelas, inclusive `plans`/`subscriptions` vazias para a cobrança futura, `consents` para a LGPD e `app_settings` com pesos de aderência e raio padrão (30 km) ajustáveis pelo admin.
- **Regras de negócio no banco**, não só na tela:
  - empresa nova sempre começa *pendente*; só o admin aprova;
  - ciclo de vida da vaga (rascunho → em análise → publicada/pausada/encerrada/reprovada) com transições validadas; só o admin publica, via `job_moderation`;
  - editar título, descrição ou salário de vaga publicada devolve a vaga para análise;
  - empresa sem cadastro aprovado não publica;
  - currículo só entra no banco de talentos com a versão do termo aceito; a data do consentimento é registrada;
  - contato (telefone/e-mail) só é visível à empresa após candidatura ou aceite de convite; convite aceito vira candidatura;
  - endereço amigável automático para vagas e empresas (`auxiliar-administrativo-ab12`);
  - `close_expired_jobs()` encerra vagas vencidas (será agendada com pg_cron na Fase 1).
- **RLS em todas as tabelas** e no Storage (`resumes` privado; `logos` público).
- **5.571 municípios e 27 UFs do IBGE** com latitude/longitude (PostGIS), busca sem acentos (`search_cities`) e distância (`city_distance_km`).
- **Autenticação**: e-mail e senha, link mágico e Google. Cadastro rápido pede só nome, cidade, WhatsApp e aceite dos termos (registrado em `consents`). Quem entra pelo Google escolhe o perfil em `/boas-vindas`.
- **Áreas por perfil** (`/candidato`, `/empresa`, `/admin`) protegidas pelo proxy e pelo papel do perfil; o admin já vê contadores reais.
- **Identidade visual** do escopo (verde `#00A651`, vermelho `#E31B23`, amarelo `#FFCB05`, azul-marinho `#1B2836`; títulos em Nunito). O símbolo "T" é **provisório** até o envio do SVG original.

## O que a Fase 1 entrega

- **Cadastro da empresa** (`/empresa/dados`): CNPJ validado no formulário e no banco, **inclusive o novo CNPJ alfanumérico** (vigente desde 07/2026), endereço, contatos, descrição e logotipo (PNG/JPG/WebP até 1 MB). Cadastro reprovado volta para análise quando a empresa corrige os dados; alterar CNPJ ou razão social de empresa aprovada exige nova análise.
- **Usuários da empresa** (`/empresa/usuarios`): administrador adiciona recrutadores pelo e-mail da conta de empresa, troca papéis e remove; a empresa nunca fica sem administrador.
- **Vagas** (`/empresa/vagas`): criação e edição com área, contrato, modalidade, cidade, raio e modo de região, faixa salarial, benefícios, escolaridade e experiência mínimas, habilidades exigidas/desejáveis e perguntas de triagem (sim/não, resposta curta, escolha). Lista com filtro por status e ações de enviar para análise, pausar, reativar, encerrar, reabrir, duplicar, excluir rascunho e copiar link. Tudo é salvo numa única transação (`save_job`).
- **Moderação** (`/admin/vagas`): fila por ordem de envio, aprovação, pedido de ajuste ou reprovação com motivo (visível à empresa) e retirada do ar de vaga publicada. **Aprovação de empresas** (`/admin/empresas`) com consulta automática do CNPJ na Receita (BrasilAPI), comparando razão social e situação cadastral.
- **Link público da vaga** (`/v/<slug>`): página leve para celular, **prévia rica no WhatsApp/redes** (imagem 1200×630 gerada com título, empresa, cidade e logotipo), dados estruturados do Google for Jobs, botões de WhatsApp, LinkedIn, Facebook, copiar link e compartilhamento nativo, e **QR Code** em PNG para cartazes (`/v/<slug>/qrcode`). Vaga não publicada (pausada, encerrada, em análise) não abre.
- **Página pública da empresa** (`/e/<slug>`) com todas as vagas abertas.
- **Visualizações por origem** (WhatsApp, LinkedIn, Facebook, QR Code, link copiado, página da empresa), exibidas por vaga.
- **Avisos por e-mail enfileirados** em `notifications` (decisão de moderação, aprovação/reprovação da empresa e encerramento em 3 dias); o envio entra na Fase 2.
- **Agendamentos com pg_cron** criados pela migração no Supabase: encerramento de vagas vencidas (00h05) e aviso prévio de encerramento (9h), horário de Brasília.
- O botão "Quero me candidatar" leva a uma página provisória; o fluxo de candidatura é da Fase 2.

## Rodando localmente

Requisitos: Node 20.9+ e um projeto Supabase (pode ser o de desenvolvimento).

```bash
npm install
cp .env.example .env.local   # preencha URL e chave publicável do Supabase
npm run dev
```

Verificações:

```bash
npm run lint
npm run typecheck
npm run build
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db   # precisa de PostgreSQL com PostGIS
```

O CI do GitHub (`.github/workflows/ci.yml`) roda tudo isso a cada push e pull request.

## Colocando em produção (passo a passo da Fase 0)

1. **Supabase** — crie dois projetos (ex.: `trivagas-dev` e `trivagas-prod`), região São Paulo.
2. **Migrações** — com o [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   Repita para cada projeto.
3. **Auth → URL Configuration** — *Site URL* com o endereço do site e, em *Redirect URLs*, `https://<seu-dominio>/auth/callback`, `https://<seu-dominio>/auth/confirm` e `https://*-<sua-conta>.vercel.app/**` (prévias da Vercel).
4. **Auth → Providers → Google** — crie credenciais OAuth no Google Cloud (URI de redirecionamento: `https://<ref>.supabase.co/auth/v1/callback`) e cole *Client ID* e *Secret*.
5. **Auth → Email Templates** (recomendado) — para o link funcionar mesmo se aberto em outro aparelho, use no modelo *Confirm signup*:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/painel`
   e no *Magic Link*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/painel`.
6. **SMTP** — configure um serviço de envio (ex.: Resend) em *Auth → SMTP Settings*; o envio padrão do Supabase tem limite baixo.
7. **Vercel** — importe o repositório, defina `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` em *Production* (projeto de produção) e *Preview* (projeto de desenvolvimento).
8. **Primeiro administrador** — cadastre-se pelo site e, no *SQL Editor* do Supabase, rode:
   ```sql
   update public.profiles
   set role = 'admin', onboarded_at = coalesce(onboarded_at, now())
   where email = 'seu-email@exemplo.com';
   ```

**Critério de conclusão da Fase 0:** em produção, cadastrar um candidato, uma empresa e o admin, e entrar em cada área.

**Critério de conclusão da Fase 1:** empresa cadastra os dados e uma vaga, o admin aprova ambos e o link `/v/<slug>` abre com prévia ao ser colado no WhatsApp (para a prévia funcionar, o site precisa estar num endereço público, como o da Vercel).

## Convenções

- Interface e mensagens em português; nomes de tabelas, colunas e código em inglês.
- Toda regra de acesso vai para o banco (RLS + gatilhos) e ganha um teste em `supabase/tests/rls_test.sql`.
- Versões dos termos ficam em `src/lib/legal.ts` e em `app_settings` (manter iguais).
- Nunca expor a chave secreta (`service_role`) no navegador: só variáveis de servidor na Vercel.

## Próxima fase

Fase 2 — Candidato e candidatura: currículo estruturado, envio do PDF, candidatura pelo link com respostas às perguntas de triagem, funil de candidatos na área da empresa e envio dos e-mails enfileirados em `notifications`.
