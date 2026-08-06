-- ============================================================
-- BPO FINANCEIRO - Migration: Adiciona alíquotas fiscais
-- ============================================================

ALTER TABLE public.empresa_config_fiscal
ADD COLUMN IF NOT EXISTS aliquota_simples_nacional NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS aliquota_issqn NUMERIC(5,2);

-- ============================================================
-- Fim
-- ============================================================
