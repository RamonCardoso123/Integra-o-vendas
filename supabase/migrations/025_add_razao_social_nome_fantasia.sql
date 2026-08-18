-- Migration 025: Adiciona Razão Social e Nome Fantasia à tabela de Empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;

COMMENT ON COLUMN public.empresas.razao_social IS 'Razão Social oficial obtida via Brasil API';
COMMENT ON COLUMN public.empresas.nome_fantasia IS 'Nome Fantasia obtido via Brasil API';
