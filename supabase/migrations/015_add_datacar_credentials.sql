-- ============================================================
-- Adiciona colunas de credenciais do Datacar na tabela empresas
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS datacar_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS datacar_cod_emp TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS datacar_id_operador TEXT DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.empresas.datacar_token IS 'Token de acesso à API do Datacar, fornecido pela Datalog Sistemas';
COMMENT ON COLUMN public.empresas.datacar_cod_emp IS 'Código da empresa no Datacar, fornecido pela Datalog Sistemas';
COMMENT ON COLUMN public.empresas.datacar_id_operador IS 'ID do operador no Datacar (mesmo usado para login no Datacar.Cloud)';
