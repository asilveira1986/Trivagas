import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";

export type Email = { subject: string; html: string; text: string };
type Payload = Record<string, string | null | undefined>;

const escape = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout({ subject, paragraphs, action }: { subject: string; paragraphs: string[]; action?: { label: string; path: string } }): Email {
  const url = action ? `${siteUrl()}${action.path}` : null;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f5f7;font-family:Arial,Helvetica,sans-serif;color:#1b2836">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#00a651 0 33%,#e31b23 33% 66%,#ffcb05 66% 100%)"></td></tr>
<tr><td style="padding:24px 28px 8px;font-size:22px;font-weight:800">TRIVagas</td></tr>
<tr><td style="padding:8px 28px 0;font-size:18px;font-weight:700">${escape(subject)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.5">${escape(p)}</td></tr>`).join("")}
${url ? `<tr><td style="padding:24px 28px 8px"><a href="${escape(url)}" style="display:inline-block;background:#00a651;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">${escape(action!.label)}</a></td></tr>` : ""}
<tr><td style="padding:24px 28px;font-size:12px;color:#5b6775">Você recebeu este e-mail porque tem uma conta no Trivagas.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [subject, "", ...paragraphs, ...(url ? ["", `${action!.label}: ${url}`] : [])].join("\n");
  return { subject, html, text };
}

const RENDERERS: Record<string, (p: Payload) => Email | null> = {
  job_moderated: (p) => {
    const path = `/empresa/vagas/${p.job_id}`;
    if (p.decision === "approved") {
      return layout({
        subject: `Sua vaga "${p.job_title}" foi publicada`,
        paragraphs: ["A vaga foi aprovada pela nossa equipe e o link público já está no ar. Compartilhe no WhatsApp, nas redes ou imprima o QR Code."],
        action: { label: "Divulgar a vaga", path },
      });
    }
    const requested = p.decision === "changes_requested";
    return layout({
      subject: requested ? `Ajuste solicitado na vaga "${p.job_title}"` : `A vaga "${p.job_title}" não foi aprovada`,
      paragraphs: [
        requested ? "Nossa equipe pediu um ajuste antes de publicar a vaga." : "Nossa equipe não aprovou a publicação da vaga.",
        `Motivo: ${p.reason ?? "não informado"}`,
      ],
      action: { label: requested ? "Ajustar a vaga" : "Ver a vaga", path },
    });
  },

  company_reviewed: (p) => {
    if (p.status === "approved") {
      return layout({
        subject: `Cadastro da ${p.trade_name} aprovado`,
        paragraphs: ["Sua empresa já pode publicar vagas no Trivagas. As vagas enviadas para análise serão avaliadas em seguida."],
        action: { label: "Criar uma vaga", path: "/empresa/vagas/nova" },
      });
    }
    return layout({
      subject: p.status === "blocked" ? `Cadastro da ${p.trade_name} bloqueado` : `Cadastro da ${p.trade_name} não aprovado`,
      paragraphs: [`Motivo: ${p.reason ?? "não informado"}`, "Corrija os dados ou fale com o suporte do Trivagas."],
      action: { label: "Revisar os dados", path: "/empresa/dados" },
    });
  },

  job_closing_soon: (p) =>
    layout({
      subject: `A vaga "${p.job_title}" encerra em ${formatDate(p.closes_at)}`,
      paragraphs: ["Depois dessa data a vaga sai do ar automaticamente. Se precisar de mais tempo, altere a data de encerramento."],
      action: { label: "Ver a vaga", path: `/empresa/vagas/${p.job_id}` },
    }),

  new_application: (p) =>
    layout({
      subject: `Nova candidatura: ${p.candidate_name} para "${p.job_title}"`,
      paragraphs: [`${p.candidate_name} se candidatou à vaga ${p.job_title}${p.source === "invite" ? " a partir do seu convite" : ""}.`],
      action: { label: "Ver candidato", path: `/empresa/candidatos/${p.application_id}` },
    }),

  application_received: (p) =>
    layout({
      subject: `Recebemos sua candidatura para "${p.job_title}"`,
      paragraphs: [
        `Sua candidatura foi enviada para ${p.company_name}. Você será avisado(a) por e-mail quando houver novidades.`,
        "Dica: um currículo completo, com experiências e habilidades, aumenta suas chances.",
      ],
      action: { label: "Acompanhar candidaturas", path: "/candidato/candidaturas" },
    }),

  application_stage_changed: (p) => {
    const messages: Record<string, [string, string]> = {
      interview: [`Você foi selecionado(a) para entrevista`, `${p.company_name} quer conversar com você sobre a vaga ${p.job_title}. Fique atento(a) ao seu telefone e e-mail.`],
      approved: [`Boa notícia sobre a vaga "${p.job_title}"`, `${p.company_name} aprovou sua candidatura. A empresa entrará em contato com os próximos passos.`],
      rejected: [`Atualização sobre a vaga "${p.job_title}"`, `${p.company_name} seguiu com outros candidatos nesta vaga. Agradecemos seu interesse — continue de olho em novas vagas perto de você.`],
    };
    const message = messages[p.stage ?? ""];
    if (!message) return null;
    return layout({ subject: message[0], paragraphs: [message[1]], action: { label: "Ver minhas candidaturas", path: "/candidato/candidaturas" } });
  },
};

export function renderEmail(template: string, payload: unknown): Email | null {
  const render = RENDERERS[template];
  return render ? render((payload ?? {}) as Payload) : null;
}
