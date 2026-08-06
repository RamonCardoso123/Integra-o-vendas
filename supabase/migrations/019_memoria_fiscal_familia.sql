-- Tabela de Memória Fiscal por Família/Categoria de Produto
-- Permite que ao salvar o NCM de um "PNEU", todos os pneus futuros já venham com o NCM correto.
-- A busca é feita por palavra-chave na descrição do produto.

CREATE TABLE IF NOT EXISTS memoria_fiscal_familia (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  palavra_chave text NOT NULL,
  ncm text,
  cest text,
  tipo_produto text,
  origem text,
  unidade_medida text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, palavra_chave)
);

-- Índice para busca rápida por empresa
CREATE INDEX IF NOT EXISTS idx_memoria_fiscal_familia_empresa ON memoria_fiscal_familia(empresa_id);
