# Trivagas — Escopo do Portal de Vagas

8 de out. de 2026 · @Alexsandro

## 1. Visão geral

O Trivagas é um portal de anúncio de vagas no modelo da Sólides: a empresa cadastra a vaga, recebe um link público para compartilhar e acompanha as candidaturas em uma área própria. Os currículos recebidos formam um banco de talentos que as empresas consultam por compatibilidade com a vaga, sempre priorizando a região.

### Objetivos

- Permitir que qualquer empresa publique uma vaga e a divulgue por link em poucos minutos.
- Dar à empresa um painel único com seus dados cadastrais, suas vagas e os candidatos de cada uma.
- Manter uma base de currículos reutilizável, com busca por região e por aderência à vaga.
- Garantir qualidade do conteúdo com moderação de todas as vagas.

### Premissas

- Lançamento em todo o Brasil desde a primeira versão, com projeto iniciado do zero.
- Banco de dados, autenticação e arquivos no Supabase; aplicação hospedada na Vercel.
- Aplicação web responsiva, pensada primeiro para celular, já que a maioria dos candidatos chega pelo link em WhatsApp e redes sociais.

## 2. Perfis de usuário

O portal tem quatro perfis, cada um com acesso apenas ao que lhe pertence.

| Perfil | Quem é | O que pode fazer |
| --- | --- | --- |
| Visitante | Qualquer pessoa com o link ou no site | Ver vagas publicadas, buscar e iniciar uma candidatura |
| Candidato | Pessoa cadastrada com currículo | Manter o currículo, candidatar-se, acompanhar candidaturas, autorizar ou retirar o currículo do banco de talentos |
| Empresa | Anunciante; pode ter mais de um usuário (administrador e recrutador) | Manter dados cadastrais, criar e gerir vagas, gerar links, avaliar candidatos, consultar o banco de currículos |
| Administrador do portal | Equipe do Trivagas | Aprovar empresas, moderar vagas, gerir catálogos (áreas, habilidades, regiões), ver métricas e atender denúncias |

## 3. Módulos e funcionalidades

O escopo se divide em cinco módulos; os três primeiros cobrem o que foi pedido diretamente e os dois últimos sustentam a operação.

### 3.1 Vagas e link de compartilhamento

- Cadastro de vaga com título, descrição, área, habilidades exigidas e desejáveis, tipo de contrato (CLT, PJ, estágio, temporário), modalidade (presencial, híbrida, remota), cidade e estado, faixa salarial opcional, benefícios, número de posições e data de encerramento.
- Perguntas de triagem opcionais por vaga (por exemplo: possui CNH, disponibilidade de horário).
- Ciclo de vida da vaga: rascunho, em análise, publicada, pausada, encerrada e reprovada.
- Link público único por vaga, com endereço amigável (ex.: `trivagas.com.br/v/auxiliar-administrativo-ab12`).
- Botões de compartilhamento para WhatsApp, LinkedIn, Facebook e copiar link, além de QR Code para cartazes.
- Prévia rica ao colar o link em redes sociais: título, empresa, cidade e logotipo.
- Página pública da empresa, com todas as suas vagas abertas em um único link.
- Contagem de visualizações e de candidaturas por link, com origem do acesso.

### 3.2 Área da empresa anunciante

- Cadastro com CNPJ, razão social, nome fantasia, segmento, porte, endereço, contatos, logotipo e descrição institucional.
- Painel inicial com vagas ativas, candidaturas recebidas, vagas em análise e vagas próximas do encerramento.
- Lista das vagas com filtro por status e ações de editar, pausar, encerrar, duplicar e copiar link.
- Funil de candidatos por vaga: novo, em análise, entrevista, aprovado e reprovado, com anotações internas e nota de avaliação.
- Visualização do currículo e download do arquivo anexado.
- Gestão de usuários da empresa, com papéis de administrador e recrutador.
- Histórico de vagas encerradas e de candidatos avaliados.

### 3.3 Área do candidato

- Criação de conta rápida e prática: entrada com Google ou e-mail, pedindo só nome, cidade e contato na primeira etapa; o currículo completo pode ser preenchido depois.
- Currículo estruturado: dados pessoais, cidade e estado, objetivo, experiências, formação, cursos, habilidades, idiomas e pretensão salarial opcional.
- Envio do currículo em PDF como complemento.
- Candidatura em poucos passos a partir do link da vaga, com resposta às perguntas de triagem.
- Acompanhamento do status de cada candidatura.
- Controle de privacidade: autorizar, pausar ou retirar o currículo do banco de talentos, e excluir a conta.

### 3.4 Banco de currículos

- Armazenamento de todos os currículos cadastrados, com entrada no banco de talentos somente mediante autorização do candidato.
- Sugestão automática de currículos para cada vaga publicada, ordenados por região e compatibilidade.
- Busca manual com filtros por cidade, raio de distância, área, habilidades, escolaridade e experiência.
- Indicador de aderência (percentual) explicando o que pesou: habilidades em comum, área, experiência e distância.
- Convite ao candidato para participar da vaga; o contato só é liberado quando ele aceita.
- Favoritos e listas de talentos por empresa.

### 3.5 Administração do portal

- Fila de moderação de vagas, com aprovação, reprovação com motivo e pedido de ajuste.
- Aprovação do cadastro de empresas, com validação do CNPJ.
- Catálogos de áreas, habilidades, cidades e regiões atendidas.
- Gestão de usuários, bloqueios e denúncias de vagas.
- Métricas gerais: empresas ativas, vagas publicadas, candidaturas, currículos no banco e tempo médio de moderação.

## 4. Regras de negócio

A região é o primeiro critério de ordenação dos currículos, e a empresa decide em cada vaga se ela restringe ou apenas prioriza.

### Região

- Toda vaga presencial ou híbrida tem cidade e estado; todo currículo também.
- Ao cadastrar a vaga, a empresa escolhe um dos dois modos: restringir (só aparecem candidatos da região) ou priorizar (candidatos próximos aparecem primeiro, os demais em seguida).
- O raio de proximidade é ajustável dos dois lados: a empresa define o raio ao buscar currículos para a vaga e o candidato define o seu ao consultar vagas. A ordem de proximidade é: mesma cidade, cidades dentro do raio, mesmo estado, restante do país.
- Vaga remota ignora a região e abrange todos os currículos.
- Cidades seguem a tabela do IBGE com latitude e longitude, o que permite cálculo de distância e expansão para qualquer região sem retrabalho.

### Compatibilidade

- A aderência combina habilidades exigidas e desejáveis, área de atuação, tempo de experiência e escolaridade.
- Dentro de cada faixa de proximidade, os currículos são ordenados pela aderência.
- Os pesos ficam em configuração do administrador, para ajuste sem nova versão do sistema.

### Consentimento do candidato

- O currículo só entra no banco de talentos com aprovação expressa do candidato.
- Sem essa aprovação, o currículo é visto apenas pelas empresas das vagas em que ele se candidatou.
- No banco de talentos, a empresa vê o perfil profissional; telefone e e-mail são liberados quando o candidato aceita o convite ou se candidata.

### Moderação

- Toda vaga passa por aprovação antes de ser publicada, e o link público só funciona após a aprovação.
- Edições em campos sensíveis de uma vaga publicada (título, descrição, salário) devolvem a vaga para análise.
- Empresa só publica depois de ter o cadastro aprovado.
- Vagas encerram automaticamente na data de encerramento, com aviso prévio à empresa.

## 5. Funcionalidades adicionais recomendadas

Além do que foi pedido, estes itens são comuns em portais desse perfil; a coluna de prioridade indica o que vale entrar já na primeira versão.

| Funcionalidade | Por que importa | Prioridade |
| --- | --- | --- |
| Notificações por e-mail (nova candidatura, vaga aprovada ou reprovada, mudança de status) | Mantém empresa e candidato informados sem precisar entrar no portal | Primeira versão |
| Busca pública de vagas com filtros por cidade, raio de distância ajustável, área e modalidade | Atrai candidatos além do link direto e alimenta o banco de currículos | Primeira versão |
| SEO e dados estruturados de vaga (Google for Jobs) | Faz as vagas aparecerem na busca do Google sem custo | Primeira versão |
| Denúncia de vaga | Protege candidatos contra golpes e apoia a moderação | Primeira versão |
| Termos de uso, política de privacidade e registro de consentimento | Exigência da LGPD para tratar currículos | Primeira versão |
| Alerta de vagas para o candidato (novas vagas na sua cidade e área) | Traz o candidato de volta e aumenta candidaturas | Segunda fase |
| Notificação por WhatsApp | Canal com maior taxa de leitura no Brasil | Segunda fase |
| Relatórios da empresa (visualizações, conversão por link, tempo de fechamento) | Mostra o retorno do anúncio e sustenta uma futura cobrança | Segunda fase |
| Leitura automática do PDF do currículo para preencher o cadastro | Reduz desistência no cadastro | Segunda fase |
| Vaga para pessoa com deficiência e vaga afirmativa | Atende cotas legais e políticas de diversidade das empresas | Segunda fase |
| Vaga confidencial (sem nome da empresa) | Permite substituições sigilosas | Segunda fase |
| Planos e cobrança (vaga em destaque, limite de vagas, acesso ao banco de talentos) | Monetização; a estrutura de planos já fica prevista no banco | Terceira fase |
| Testes e perfil comportamental | Diferencial da Sólides; exige conteúdo próprio | Terceira fase |
| API e integração com sistemas de RH | Atende empresas maiores | Terceira fase |

## 6. Arquitetura técnica

A aplicação é um único projeto Next.js publicado na Vercel, com o Supabase como banco de dados, autenticação e armazenamento de arquivos.

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Aplicação web | Next.js (App Router) com TypeScript, Tailwind CSS e shadcn/ui | Páginas públicas renderizadas no servidor (bom para SEO e prévia do link) e áreas logadas |
| Hospedagem | Vercel | Publicação automática a partir do GitHub, ambiente de prévia por alteração, domínio e HTTPS |
| Banco de dados | Supabase (PostgreSQL) | Todas as tabelas do portal, com migrações versionadas no repositório |
| Autenticação | Supabase Auth | Login por e-mail e senha, link mágico e Google; papel do usuário guardado no perfil |
| Controle de acesso | Row Level Security (RLS) do PostgreSQL | Cada empresa enxerga só suas vagas e candidatos; cada candidato só o próprio currículo |
| Arquivos | Supabase Storage | Currículos em PDF em área privada com link temporário; logotipos em área pública |
| Busca e compatibilidade | Busca textual em português e extensão PostGIS no PostgreSQL | Filtro por raio de distância e cálculo de aderência em uma função do banco |
| Tarefas agendadas | pg_cron e Edge Functions do Supabase | Encerrar vagas vencidas, enviar alertas e lembretes |
| E-mail transacional | Serviço de envio (ex.: Resend) | Confirmações, avisos de candidatura e resultado da moderação |
| Monitoramento | Vercel Analytics e registro de erros (ex.: Sentry) | Acompanhar desempenho e falhas em produção |

- **Ambientes:** dois projetos no Supabase (desenvolvimento e produção) ligados aos ambientes de prévia e produção da Vercel.
- **Segredos:** a chave de serviço do Supabase fica apenas em variáveis de ambiente do servidor na Vercel, nunca no navegador.

## 7. Modelo de dados

O banco se organiza em torno de quatro entidades centrais (empresa, vaga, currículo e candidatura), apoiadas por catálogos e registros de auditoria.

| Tabela | Conteúdo principal | Relações |
| --- | --- | --- |
| profiles | Nome, telefone e papel do usuário (candidato, empresa, administrador) | Um para um com o usuário do Supabase Auth |
| companies | CNPJ, razão social, nome fantasia, segmento, porte, endereço, logotipo, descrição, status de aprovação, endereço amigável | Cidade em cities |
| company_members | Usuários da empresa e seu papel (administrador, recrutador) | companies e profiles |
| jobs | Título, descrição, área, contrato, modalidade, salário, benefícios, posições, encerramento, status, modo de região (restringir ou priorizar), raio, endereço amigável | companies, cities, areas |
| job_skills | Habilidades da vaga, marcadas como exigida ou desejável | jobs e skills |
| job_questions | Perguntas de triagem da vaga | jobs |
| resumes | Objetivo, escolaridade, pretensão, arquivo PDF, autorização do banco de talentos e data do consentimento | profiles, cities, areas |
| resume_experiences | Empresa, cargo, período e atividades | resumes |
| resume_education | Curso, instituição, nível e período | resumes |
| resume_skills | Habilidades do candidato e nível | resumes e skills |
| applications | Candidatura, etapa do funil, nota, origem (link, busca, convite) e data | jobs e resumes |
| application_answers | Respostas às perguntas de triagem | applications e job_questions |
| application_notes | Anotações internas da empresa | applications e profiles |
| talent_invites | Convites da empresa a currículos do banco e resposta do candidato | jobs e resumes |
| saved_resumes | Favoritos da empresa | companies e resumes |
| job_moderation | Decisão, motivo, moderador e data de cada análise | jobs e profiles |
| job_reports | Denúncias de vagas | jobs |
| job_views | Visualizações do link por data e origem | jobs |
| cities | Código IBGE, nome, estado, latitude e longitude | regions |
| regions | Agrupamento de cidades por estado e região do país, para filtros e relatórios | — |
| areas e skills | Catálogos de áreas de atuação e habilidades | — |
| plans e subscriptions | Planos e assinatura da empresa (criadas vazias, para a cobrança futura) | companies |
| notifications | Fila e histórico de e-mails enviados | profiles |
| audit_log | Quem acessou ou alterou dados pessoais e quando | profiles |

A compatibilidade entre vaga e currículo é calculada por uma função do banco, que recebe a vaga e devolve os currículos autorizados já ordenados por faixa de proximidade e aderência.

## 8. LGPD e segurança

Currículo é dado pessoal, então o portal precisa registrar consentimento, limitar o acesso e permitir exclusão desde a primeira versão.

- Consentimento separado para cada finalidade: candidatar-se a uma vaga e participar do banco de talentos, com data e versão do termo registradas.
- Candidato pode ver, corrigir, baixar e excluir seus dados, e retirar a autorização do banco de talentos a qualquer momento.
- Empresa acessa apenas currículos de suas candidaturas e currículos autorizados no banco; os dados de contato ficam ocultos até o aceite do convite.
- Não coletar dados sensíveis desnecessários (CPF, foto, estado civil, religião); informação de deficiência só por declaração voluntária, para vagas afirmativas.
- Prazo de retenção: o currículo inativo permanece por 6 meses; o candidato é avisado antes do fim do prazo e, sem retorno, os dados são removidos em definitivo.
- Arquivos de currículo em armazenamento privado, entregues por link temporário.
- Regras de acesso aplicadas no banco (RLS), e não apenas na tela.
- Registro de acesso a currículos em audit_log.
- Proteção contra cadastro automatizado e limite de requisições nos formulários públicos.
- Cópia de segurança diária do banco e indicação de um encarregado de dados (DPO) na política de privacidade.

Os textos dos termos de uso e da política de privacidade devem ser revisados por um advogado antes do lançamento.

## 9. Fases de entrega

A primeira versão entrega o ciclo completo (empresa publica, candidato se candidata pelo link, empresa encontra currículos por região); as fases seguintes ampliam alcance e receita.

| Fase | Entregas | Critério de conclusão |
| --- | --- | --- |
| 0. Fundação | Projeto Next.js na Vercel, projetos Supabase, tabelas e RLS, autenticação e papéis, carga de cidades do IBGE | Usuário se cadastra e entra em cada perfil, em produção |
| 1. Empresa e vagas | Cadastro da empresa, criação de vagas, moderação, página pública da vaga, link, compartilhamento e QR Code | Uma vaga aprovada abre pelo link, com prévia no WhatsApp |
| 2. Candidato e candidatura | Currículo estruturado, envio de PDF, candidatura pelo link, funil de candidatos na área da empresa, e-mails | Empresa recebe e avalia uma candidatura de ponta a ponta |
| 3. Banco de currículos | Consentimento, sugestão por região e aderência, busca com filtros, convites e favoritos | Vaga publicada mostra currículos ordenados conforme a regra de região |
| 4. Lançamento nacional | Painel administrativo com métricas, busca pública de vagas, SEO, denúncias, termos e política, testes e ajustes | Portal aberto para todo o Brasil |
| 5. Evolução | Alertas de vagas, WhatsApp, relatórios da empresa, leitura automática de PDF, vagas afirmativas e confidenciais | Definido conforme uso real |
| 6. Monetização | Planos, cobrança e vaga em destaque | Inicia somente após a finalização do portal |

## 10. Pontos em aberto

Estas definições ainda dependem de decisão e afetam o desenvolvimento.

- [x] Qual será a região de lançamento e quais cidades ela inclui?
- [x] Qual o raio padrão de proximidade (por exemplo, 30 km) e a empresa poderá alterá-lo?
- [x] Quando e como cobrar: por vaga, assinatura ou acesso ao banco de talentos?
- [ ] Quem fará a moderação das vagas e qual o prazo máximo de resposta?
- [x] O candidato precisa de conta para se candidatar ou basta enviar o currículo com e-mail confirmado?
- [x] Por quanto tempo um currículo inativo permanece no banco antes de ser anonimizado?
- [ ] Domínio definitivo e identidade visual do Trivagas.
- [x] O que já foi construído na versão anterior (Next.js com Prisma e NextAuth) será migrado para Supabase Auth e RLS ou o projeto recomeça do zero?

### Definições registradas em 08/10/2026

- Abrangência: todo o Brasil desde o lançamento.
- Raio de proximidade ajustável pela empresa recrutadora e pelo candidato ao consultar vagas.
- Cobrança: etapa posterior à finalização do portal.
- Conta do candidato: criação rápida e prática.
- Currículo inativo: permanece 6 meses e depois é removido em definitivo.
- Domínio: definido em um segundo momento.
- Desenvolvimento: começa do zero, sem migrar a versão anterior.

## 11. Identidade visual

A interface segue o logotipo enviado: marca TRIVagas com um "T" em faixas verde, vermelha e amarela e o texto "Vagas" em azul-marinho.

| Uso | Cor | Código aproximado |
| --- | --- | --- |
| Cor principal (botões, links, destaques) | Verde | `#00A651` |
| Alertas e ações de atenção | Vermelho | `#E31B23` |
| Selos e destaques secundários (vaga em destaque, novidades) | Amarelo | `#FFCB05` |
| Textos, cabeçalho e rodapé | Azul-marinho | `#1B2836` |
| Fundo | Branco | `#FFFFFF` |

- Os códigos foram estimados a partir da imagem; os valores exatos devem vir do arquivo original do logotipo.
- Tipografia sem serifa, pesada e arredondada nos títulos, acompanhando o desenho do logotipo.
- O símbolo "T" isolado serve como ícone do site e imagem de prévia dos links de vaga.
- Pedir o logotipo em vetor (SVG) e uma versão para fundo escuro.
