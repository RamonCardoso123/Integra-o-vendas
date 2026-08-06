-- ============================================================
-- Adiciona a coluna categoria na tabela contas_pagar_importadas
-- para possibilitar salvar a categoria vinda do Datacar ou Planilha
-- ============================================================

ALTER TABLE public.contas_pagar_importadas ADD COLUMN IF NOT EXISTS categoria TEXT;
