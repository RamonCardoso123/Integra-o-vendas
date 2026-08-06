-- ============================================================
-- Adiciona a coluna tipo_empresa para separar empresas de Vendas e Contas a Pagar/Receber
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tipo_empresa TEXT DEFAULT 'ambos' 
CHECK (tipo_empresa IN ('vendas', 'financeiro', 'ambos'));
