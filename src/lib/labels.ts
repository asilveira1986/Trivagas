export const CONTRACT_TYPES = {
  clt: "CLT",
  pj: "PJ",
  internship: "Estágio",
  temporary: "Temporário",
} as const;

export const WORK_MODES = {
  on_site: "Presencial",
  hybrid: "Híbrida",
  remote: "Remota",
} as const;

export const JOB_STATUSES = {
  draft: "Rascunho",
  in_review: "Em análise",
  published: "Publicada",
  paused: "Pausada",
  closed: "Encerrada",
  rejected: "Reprovada",
} as const;

export const COMPANY_STATUSES = {
  pending: "Em análise",
  approved: "Aprovada",
  rejected: "Reprovada",
  blocked: "Bloqueada",
} as const;

export const COMPANY_SIZES = {
  mei: "MEI",
  micro: "Microempresa",
  small: "Pequena",
  medium: "Média",
  large: "Grande",
} as const;

export const MEMBER_ROLES = {
  admin: "Administrador",
  recruiter: "Recrutador",
} as const;

export const EDUCATION_LEVELS = {
  elementary: "Ensino fundamental",
  high_school: "Ensino médio",
  technical: "Técnico",
  undergraduate: "Superior",
  postgraduate: "Pós-graduação",
  masters: "Mestrado",
  doctorate: "Doutorado",
} as const;

export const REGION_MODES = {
  prioritize: "Priorizar candidatos da região",
  restrict: "Somente candidatos da região",
} as const;

export const QUESTION_TYPES = {
  yes_no: "Sim ou não",
  short_text: "Resposta curta",
  single_choice: "Escolha uma opção",
} as const;

export const MODERATION_DECISIONS = {
  approved: "Aprovada",
  rejected: "Reprovada",
  changes_requested: "Ajuste solicitado",
} as const;

export const VIEW_SOURCES: Record<string, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  qrcode: "QR Code",
  link: "Link copiado",
  empresa: "Página da empresa",
  direct: "Acesso direto",
};

export type ContractType = keyof typeof CONTRACT_TYPES;
export type WorkMode = keyof typeof WORK_MODES;
export type JobStatus = keyof typeof JOB_STATUSES;
export type CompanyStatus = keyof typeof COMPANY_STATUSES;
export type CompanySize = keyof typeof COMPANY_SIZES;
export type MemberRole = keyof typeof MEMBER_ROLES;
export type EducationLevel = keyof typeof EDUCATION_LEVELS;
export type RegionMode = keyof typeof REGION_MODES;
export type QuestionType = keyof typeof QUESTION_TYPES;
export type ModerationDecision = keyof typeof MODERATION_DECISIONS;
