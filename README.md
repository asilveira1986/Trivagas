# Trivagas

Portal de anúncio de vagas: a empresa cadastra a vaga, compartilha um link público e acompanha as candidaturas; os currículos formam um banco de talentos consultado por região e aderência. Escopo completo em [`docs/escopo.md`](docs/escopo.md).

**Situação:** Fases 0 a 5 (Fundação, Empresa e vagas, Candidato e candidatura, Banco de currículos, Lançamento nacional e Evolução) concluídas no código. Falta a implantação e a lista de verificação de lançamento abaixo. Falta criar os projetos Supabase/Vercel e publicar (passo a passo abaixo).

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

## O que a Fase 2 entrega

- **Currículo estruturado** (`/candidato/curriculo`): dados pessoais, título, objetivo, área, escolaridade, pretensão, raio de busca, experiências, formação e cursos, habilidades com nível e idiomas — salvo numa transação (`save_resume`). Tempo total de experiência calculado no banco sem contar períodos sobrepostos duas vezes.
- **PDF do currículo** enviado direto do navegador para a área privada do Storage (até 5 MB; não passa pelo servidor, que na Vercel limita requisições a 4,5 MB). Empresas abrem por link temporário de 10 minutos.
- **Candidatura em poucos passos** (`/v/<slug>/candidatar`): visitante cria a conta e volta para a vaga; o candidato confere os dados, anexa o PDF se quiser, responde às perguntas de triagem e autoriza o envio do currículo à empresa (consentimento registrado por vaga). Tudo numa transação (`apply_to_job`), com validação das respostas obrigatórias e bloqueio de candidatura duplicada; a origem do link (WhatsApp, QR Code…) é guardada.
- **Acompanhamento** (`/candidato/candidaturas`) com etapa em linguagem do candidato e opção de desistir; painel do candidato com o quanto falta para completar o currículo.
- **Funil da empresa** (`/empresa/candidatos`): filtro por vaga e etapa com contagens; ficha do candidato com contato (e atalho para WhatsApp), respostas, currículo, PDF, mudança de etapa, nota de 1 a 5 e anotações internas. Cada abertura de currículo fica em `audit_log` (LGPD).
- **E-mails** via Resend: nova candidatura (para a equipe da empresa), confirmação de candidatura e mudança para entrevista/aprovado/reprovado (para o candidato), além dos avisos da Fase 1. O envio acontece logo após cada ação; uma rotina diária (`vercel.json` → `/api/notificacoes`) envia o que restou e refaz falhas (até 5 tentativas, sem duplicar o e-mail).

## O que a Fase 3 entrega

- **Consentimento do banco de talentos** (`/candidato/privacidade`): o candidato autoriza (com versão do termo registrada), pausa ou retira o currículo a qualquer momento; autorização e retirada ficam no histórico de consentimentos.
- **Sugestão de currículos por vaga e busca manual** (`/empresa/talentos`), numa única função do banco (`talent_search`), liberada só para empresas aprovadas:
  - ordem por **faixa de proximidade** — mesma cidade, dentro do raio, mesmo estado, resto do país (sem cidade por último); vaga remota ignora a região; no modo **restringir** só aparecem a cidade e o raio;
  - dentro de cada faixa, pela **aderência** (%): habilidades exigidas e desejáveis, área, experiência e escolaridade, com **pesos lidos de `app_settings`** (ajustáveis pelo admin sem nova versão) e só sobre os critérios que a vaga define;
  - cada resultado explica o que pesou (ex.: "1 de 2 habilidades exigidas", área, experiência, escolaridade, habilidades em comum);
  - filtros por cidade e raio, área, habilidades (todas), escolaridade, experiência mínima e palavras-chave (sem acentos), com paginação.
- **Privacidade no banco**: a empresa vê o perfil profissional com **nome abreviado** ("Ana F."); nome completo, telefone, e-mail e **PDF** só depois da candidatura ou do aceite do convite (regra no banco e no Storage). Cada abertura de perfil vai para `audit_log`.
- **Convites**: a empresa convida para uma vaga publicada com mensagem; o candidato recebe e-mail, vê o convite em "Candidaturas" e aceita pelo fluxo de candidatura (respondendo às perguntas de triagem) ou recusa. Aceite vira candidatura com origem "convite".
- **Favoritos e listas** da empresa (`/empresa/talentos/salvos`), compartilhados entre os usuários.
- **LGPD do candidato**: baixar todos os dados em JSON e excluir a conta definitivamente (remove PDF, usuário do Auth e, em cascata, currículo, candidaturas e consentimentos — exige `SUPABASE_SECRET_KEY`).

## O que a Fase 4 entrega

- **Busca pública de vagas** (`/vagas`, função `search_jobs`): palavra-chave (sem acentos), cidade com **raio ajustável** (mais próximas primeiro e, depois, as remotas, que valem para todo o Brasil), área, modalidade e contrato, com paginação. Para o candidato logado, a busca já começa pela cidade e pelo raio do currículo; a área do candidato mostra "Vagas perto de você". Página inicial com busca e vagas recentes.
- **SEO**: `sitemap.xml` (vagas publicadas e empresas aprovadas, atualizado de hora em hora), `robots.txt` fechando as áreas logadas, metadados e dados estruturados de vaga (Google for Jobs).
- **Denúncia de vaga** (`/v/<slug>/denunciar`) com motivos pré-definidos, anti-robô (Cloudflare Turnstile) e limite de 5 denúncias por hora por conexão; a gravação passa pelo servidor (a API pública não aceita mais inserção direta). O admin recebe um e-mail por vaga denunciada.
- **Painel administrativo**:
  - métricas (`admin_metrics`): empresas ativas e pendentes, vagas publicadas e em análise, candidaturas, cadastros, currículos no banco, visualizações, denúncias abertas e **tempo médio de moderação** (guardado em cada decisão);
  - **denúncias** (`/admin/denuncias`): retirar a vaga do ar com motivo (resolve as denúncias abertas da vaga e avisa a empresa), resolver ou arquivar;
  - **catálogos e pesos** (`/admin/catalogos`): áreas e habilidades (adicionar, desativar), pesos da aderência (somando 100), raio padrão e prazo de retenção — aplicados na hora;
  - **usuários** (`/admin/usuarios`): busca por nome ou e-mail, filtro por perfil, bloqueio e desbloqueio.
- **Retenção (LGPD)**: rotina diária (`/api/rotinas/retencao`) avisa por e-mail quem está há 5 meses sem acesso e, sem retorno em 25 dias, remove definitivamente a conta e o PDF ao completar 6 meses (prazo configurável). Entrar no portal cancela o aviso; a atividade é registrada no máximo a cada 12 horas.
- **Proteção**: Turnstile no cadastro e na denúncia, limite de tentativas no cadastro (5/h) e no link por e-mail (5 a cada 15 min), cabeçalhos de segurança (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Textos legais**: termos de uso e política de privacidade completos como minuta (finalidades, compartilhamento, direitos, retenção, segurança, contato do encarregado lido de `app_settings.privacy_contact_email`) — **precisam de revisão jurídica**.
- **Monitoramento**: Vercel Analytics e Speed Insights (ativos ao publicar na Vercel).

## O que a Fase 5 entrega

- **Alertas de vagas** (`/candidato/alertas`, até 5 por pessoa): palavra-chave, cidade e raio, área, modalidade, contrato e "só afirmativas", diário ou semanal; criados também com um clique a partir de uma busca em `/vagas`. A rotina diária (`queue_job_alerts`, chamada por `/api/notificacoes`) envia só as vagas novas desde o último aviso.
- **WhatsApp** (Cloud API da Meta): o candidato ativa em Privacidade (consentimento registrado; exige telefone). Recebe por WhatsApp, além do e-mail, entrevista/aprovação/reprovação, convites e alertas. A fila é separada por canal; os **modelos de mensagem** (`trivagas_etapa_candidatura`, `trivagas_convite_vaga`, `trivagas_alerta_vagas`, com as variáveis descritas em `src/lib/notifications/whatsapp.ts`) precisam ser aprovados no WhatsApp Business Manager.
- **Relatórios da empresa** (`/empresa/relatorios`, 30/90 dias ou 12 meses): visualizações, candidaturas, conversão e tempo médio até encerrar; visualizações por origem do link; tabela por vaga com funil e principal origem; exportação **CSV** (separador ";", abre direto no Excel).
- **Leitura automática do PDF** (`/candidato/curriculo` → "Ler meu PDF"): o PDF anexado é enviado à API do Claude (modelo `claude-opus-5-5`, saída estruturada em JSON Schema com área, escolaridade e habilidades restritas ao catálogo, `fallbacks: "default"` para recusas) e o formulário é **preenchido para revisão** — nada é salvo sem o candidato confirmar. Limite de 5 leituras por dia; requer `ANTHROPIC_API_KEY` (sem a chave, o botão não aparece).
- **Vagas afirmativas**: PcD, mulheres, pessoas negras, indígenas, LGBTQIA+ e 50+, com selo nas páginas e filtro na busca pública e nos alertas.
- **Declaração voluntária de deficiência** (dado sensível, LGPD art. 11): registrada em Privacidade com consentimento específico (e retirada ao apagar), em tabela própria (`resume_disability`) que só a empresa de uma **vaga PcD em que a pessoa se candidatou** consegue ler — nunca aparece no banco de talentos.
- **Vagas confidenciais**: o nome, o logotipo e a página da empresa não aparecem no anúncio, na busca, na imagem de prévia, nos dados estruturados nem nos e-mails e WhatsApp ao candidato. A vaga confidencial não é lida direto pela API: a página pública usa `public_job()` e a busca usa `search_jobs()`, que mascaram a empresa.

## Lista de verificação de lançamento

- [ ] Projetos Supabase (dev e produção) com as migrações aplicadas (`npx supabase db push`) e **backups diários** ativos (plano Pro: *Database → Backups*; considere PITR).
- [ ] Primeiro administrador promovido por SQL (ver passo 8 abaixo).
- [ ] Auth: URLs de retorno, Google e modelos de e-mail configurados; SMTP do Resend.
- [ ] Vercel: todas as variáveis de `.env.example`, incluindo `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` (crie o widget em *Cloudflare → Turnstile* com o domínio do site).
- [ ] As duas rotinas do `vercel.json` aparecem em *Vercel → Settings → Cron Jobs* (`/api/notificacoes` e `/api/rotinas/retencao`).
- [ ] `privacy_contact_email` em `app_settings` com o e-mail real do encarregado de dados.
- [ ] Termos de uso e política de privacidade revisados por advogado; ao mudar o texto, atualizar a versão em `src/lib/legal.ts` e em `app_settings`.
- [ ] (Fase 5) `ANTHROPIC_API_KEY` para a leitura de PDF; `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` com os três modelos de mensagem aprovados na Meta.
- [ ] Domínio definitivo apontado para a Vercel e `NEXT_PUBLIC_SITE_URL` atualizado; sitemap enviado ao Google Search Console.
- [ ] Logotipo original em SVG no lugar do símbolo provisório (`src/components/brand/trivagas-mark.tsx` e `src/app/icon.svg`).
- [ ] Teste de ponta a ponta em produção: empresa publica → vaga aprovada abre no WhatsApp → candidato se candidata → empresa avalia → convite do banco de talentos.

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
6. **E-mail (Resend)** — crie a conta, verifique o domínio de envio e gere uma API key. Use o mesmo Resend em *Auth → SMTP Settings* do Supabase (o envio padrão do Supabase tem limite baixo).
7. **Vercel** — importe o repositório e defina as variáveis de `.env.example` em *Production* (projeto de produção) e *Preview* (projeto de desenvolvimento): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, e só no servidor `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` e `CRON_SECRET`. Sem as variáveis de e-mail, os avisos ficam guardados na fila até serem configuradas.
8. **Primeiro administrador** — cadastre-se pelo site e, no *SQL Editor* do Supabase, rode:
   ```sql
   update public.profiles
   set role = 'admin', onboarded_at = coalesce(onboarded_at, now())
   where email = 'seu-email@exemplo.com';
   ```

**Critério de conclusão da Fase 0:** em produção, cadastrar um candidato, uma empresa e o admin, e entrar em cada área.

**Critério de conclusão da Fase 5:** definido conforme o uso real (escopo, seção 9); as funcionalidades listadas acima estão prontas para ativar.

**Critério de conclusão da Fase 4:** portal aberto para todo o Brasil, com a lista de verificação de lançamento concluída.

**Critério de conclusão da Fase 3:** com candidatos no banco de talentos em cidades diferentes, a vaga publicada mostra os currículos na ordem mesma cidade → dentro do raio → mesmo estado → demais regiões, e por aderência dentro de cada faixa; o convite aceito libera o contato.

**Critério de conclusão da Fase 2:** um candidato chega pelo link da vaga, cria a conta, se candidata respondendo às perguntas; a empresa recebe o e-mail, abre a ficha e move o candidato para entrevista; o candidato recebe o e-mail e vê a etapa na área dele.

**Critério de conclusão da Fase 1:** empresa cadastra os dados e uma vaga, o admin aprova ambos e o link `/v/<slug>` abre com prévia ao ser colado no WhatsApp (para a prévia funcionar, o site precisa estar num endereço público, como o da Vercel).

## Convenções

- Interface e mensagens em português; nomes de tabelas, colunas e código em inglês.
- Toda regra de acesso vai para o banco (RLS + gatilhos) e ganha um teste em `supabase/tests/rls_test.sql`.
- Versões dos termos ficam em `src/lib/legal.ts` e em `app_settings` (manter iguais).
- Nunca expor a chave secreta (`service_role`) no navegador: só variáveis de servidor na Vercel.

## Próximas fases

- **Fase 6 — Monetização**: planos, cobrança e vaga em destaque (as tabelas `plans` e `subscriptions` já existem).
