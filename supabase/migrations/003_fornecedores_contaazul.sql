-- ============================================================
-- Migration 003: Tabela de fornecedores importados do ContaAzul
-- Usada para match automático de nomes ao importar Datacar
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fornecedores_contaazul (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  cnpj            TEXT,
  nome_normalizado TEXT NOT NULL, -- nome em uppercase sem pontuação para match
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa
  ON public.fornecedores_contaazul(empresa_id);

-- Índice para busca por CNPJ
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj
  ON public.fornecedores_contaazul(cnpj)
  WHERE cnpj IS NOT NULL AND cnpj != '';

-- RLS: usuários só veem fornecedores das suas empresas
ALTER TABLE public.fornecedores_contaazul ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_veem_fornecedores_da_empresa" ON public.fornecedores_contaazul
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
