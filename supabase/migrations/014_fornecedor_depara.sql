-- ============================================================
-- Migration 014: Tabela De-Para de Fornecedores (Aprendizado)
-- Armazena correções manuais de nomes feitas pelo usuário.
-- Na próxima importação, o sistema consulta essas regras
-- ANTES do match por similaridade, aplicando automaticamente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fornecedor_depara (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id                UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_original             TEXT NOT NULL,  -- nome como veio da planilha (ex: "GARRA PNEUS")
  nome_original_normalizado TEXT NOT NULL,  -- versão normalizada para busca rápida
  nome_corrigido            TEXT NOT NULL,  -- nome que o usuário escolheu (ex: "PNEUSBH LTDA")
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: uma empresa só pode ter uma regra por nome original normalizado
-- Permite UPSERT sem duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_depara_empresa_nome
  ON public.fornecedor_depara(empresa_id, nome_original_normalizado);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_depara_empresa
  ON public.fornecedor_depara(empresa_id);

-- RLS: usuários só veem regras das suas empresas
ALTER TABLE public.fornecedor_depara ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_veem_depara_da_empresa" ON public.fornecedor_depara
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
