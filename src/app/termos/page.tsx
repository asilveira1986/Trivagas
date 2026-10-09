import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de uso" };

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. O que é o Trivagas",
    items: [
      "O Trivagas é um portal que aproxima empresas que anunciam vagas de emprego e pessoas que buscam trabalho em todo o Brasil.",
      "O Trivagas não é agência de emprego, não participa da seleção e não garante contratação.",
    ],
  },
  {
    title: "2. Contas",
    items: [
      "Há contas de candidato e de empresa. Você é responsável pelas informações que cadastra e pelo sigilo da sua senha.",
      "Contas com informações falsas, uso indevido ou que violem estes termos podem ser bloqueadas.",
    ],
  },
  {
    title: "3. Regras para empresas",
    items: [
      "A empresa só publica vagas depois que o cadastro (CNPJ) é aprovado, e toda vaga passa por análise antes de ir ao ar.",
      "É proibido cobrar qualquer valor do candidato, pedir dados sensíveis desnecessários (como CPF, foto, estado civil ou religião) ou publicar vagas falsas, discriminatórias ou enganosas.",
      "Alterar título, descrição ou salário de uma vaga publicada devolve a vaga para análise.",
      "Os currículos acessados pelo portal só podem ser usados para o processo seletivo e não podem ser repassados a terceiros.",
    ],
  },
  {
    title: "4. Regras para candidatos",
    items: [
      "Ao se candidatar, você autoriza o envio do seu currículo e contatos para a empresa daquela vaga.",
      "No banco de talentos (opcional), empresas aprovadas veem seu perfil profissional sem contatos; os contatos só são liberados se você aceitar um convite.",
      "Nunca pague para participar de processo seletivo. Se isso acontecer, denuncie a vaga.",
    ],
  },
  {
    title: "5. Moderação e denúncias",
    items: [
      "A equipe do Trivagas pode recusar, pedir ajuste ou retirar do ar vagas que violem estes termos ou a lei.",
      "Qualquer pessoa pode denunciar uma vaga pelo link “Denunciar” na página da vaga.",
    ],
  },
  {
    title: "6. Disponibilidade e alterações",
    items: [
      "O portal pode passar por manutenções e mudanças. Alterações relevantes nestes termos serão comunicadas e registradas com nova versão.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-10">
      <h1 className="text-3xl font-black">Termos de uso</h1>
      <p className="text-sm text-muted-foreground">Versão {TERMS_VERSION}</p>
      <Alert>Minuta para revisão jurídica antes do lançamento.</Alert>
      {SECTIONS.map((section) => (
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
