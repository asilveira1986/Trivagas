-- Trivagas · Fase 5 · Novas finalidades de consentimento
-- (arquivo separado: valores novos de enum não podem ser usados na mesma transação em que são criados)
alter type public.consent_purpose add value if not exists 'disability_data';
alter type public.consent_purpose add value if not exists 'whatsapp';
