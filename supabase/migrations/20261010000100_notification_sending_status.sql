-- Trivagas · Fase 2 · Estado intermediário da fila de e-mails
-- (arquivo separado: um valor novo de enum não pode ser usado na mesma transação em que é criado)
alter type public.notification_status add value if not exists 'sending' after 'queued';
alter table public.notifications add column if not exists locked_at timestamptz;
