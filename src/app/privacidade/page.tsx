import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { PRIVACY_VERSION } from "@/lib/legal";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Política de privacidade" };
export const revalidate = 3600;

export default async function PrivacyPage() {
  const { data } = await createPublicClient()
    .from("app_settings")
    .select("key, value")
    .in("key", ["privacy_contact_email", "resume_retention_months"]);
  const setting = (key: string) => data?.find((row) => row.key === key)?.value;
  const contact = String(setting("privacy_contact_email") ?? "privacidade@trivagas.com.br");
  const retention = Number(setting("resume_retention_months") ?? 6);

  const sections: { title: string; items: string[] }[] = [
    {
      title: "1. Dados que coletamos",
      items: [
        "Cadastro: nome, e-mail, telefone (WhatsApp) e cidade.",
        "Currículo (opcional, preenchido por você): objetivo, experiências, formação, cursos, habilidades, idiomas, pretensão salarial e arquivo PDF.",
        "Empresas: CNPJ, razão social, endereço, contatos e dados dos usuários da empresa.",
        "Uso: visualizações de vagas por origem do link e registros de acesso a currículos, para segurança e auditoria.",
        "Não pedimos CPF, foto, estado civil, religião ou outros dados sensíveis.",
      ],
    },
    {
      title: "2. Para que usamos (finalidades e consentimento)",
      items: [
        "Candidatura: com sua autorização em cada vaga, seu currículo e contatos são enviados à empresa daquela vaga.",
        "Banco de talentos: só com sua autorização expressa, empresas aprovadas encontram seu perfil profissional; telefone, e-mail e PDF são liberados apenas se você aceitar um convite. Você pode pausar ou retirar a autorização a qualquer momento.",
        "Avisos por e-mail sobre suas candidaturas, vagas e conta.",
        "Cada autorização fica registrada com data e versão do termo.",
      ],
    },
    {
      title: "3. Com quem compartilhamos",
      items: [
        "Com as empresas, apenas nos casos acima. Não vendemos dados.",
        "Com fornecedores que operam o serviço (hospedagem, banco de dados e envio de e-mails), sob contrato e só para essa finalidade.",
      ],
    },
    {
      title: "4. Seus direitos",
      items: [
        "Ver, corrigir e baixar seus dados (área do candidato → Privacidade → Baixar meus dados).",
        "Retirar autorizações e excluir sua conta definitivamente a qualquer momento (área do candidato → Privacidade).",
        `Falar com o encarregado de dados (DPO) pelo e-mail ${contact}.`,
      ],
    },
    {
      title: "5. Por quanto tempo guardamos",
      items: [
        `Currículos sem acesso por ${retention} meses são removidos definitivamente. Avisamos por e-mail cerca de um mês antes; basta entrar no portal para manter a conta.`,
        "Ao excluir a conta, apagamos perfil, currículo, PDF, candidaturas e autorizações.",
      ],
    },
    {
      title: "6. Segurança",
      items: [
        "As regras de acesso ficam no próprio banco de dados: cada empresa vê só os candidatos das suas vagas e os currículos autorizados; cada candidato vê só os próprios dados.",
        "Arquivos de currículo ficam em área privada e são entregues por link temporário.",
        "Fazemos cópia de segurança diária do banco de dados.",
      ],
    },
  ];

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
      <h1 className="text-3xl font-black">Política de privacidade</h1>
      <p className="text-sm text-muted-foreground">Versão {PRIVACY_VERSION} · Lei Geral de Proteção de Dados (Lei 13.709/2018)</p>
      <Alert>Minuta para revisão jurídica antes do lançamento.</Alert>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">{section.title}</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
