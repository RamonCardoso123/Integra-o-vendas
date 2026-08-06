-- ============================================================
-- Adiciona coluna metadata nas tabelas de importação para armazenar 
-- dados extras do Datacar (como CPF/CNPJ, etc)
-- ============================================================

ALTER TABLE public.contas_pagar_importadas ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendas_importadas ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
