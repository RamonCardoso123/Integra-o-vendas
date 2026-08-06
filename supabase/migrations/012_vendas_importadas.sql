-- ============================================================
-- BPO FINANCEIRO - Migration: Vendas Importadas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendas_importadas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente         TEXT NOT NULL,
  os_numero       TEXT NOT NULL,
  data_venda      DATE NOT NULL,
  valor_total     NUMERIC(15, 2) NOT NULL,
  forma_pagamento TEXT,
  itens           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'enviado', 'erro', 'cancelado')),
  conta_azul_id   TEXT,
  erro_mensagem   TEXT,
  tentativas      INTEGER DEFAULT 0,
  importacao_id   UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER set_updated_at_vendas_importadas
  BEFORE UPDATE ON public.vendas_importadas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_vendas_importadas_empresa_id ON public.vendas_importadas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_importadas_status ON public.vendas_importadas(status);

-- RLS
ALTER TABLE public.vendas_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_por_empresa"
  ON public.vendas_importadas FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
