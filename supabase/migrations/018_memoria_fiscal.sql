-- Tabela de Memória Fiscal: armazena NCM, CEST, Tipo, Origem e UN por produto
-- O sistema "aprende" com as edições do usuário e reutiliza nas próximas importações.
CREATE TABLE IF NOT EXISTS memoria_fiscal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo VARCHAR(100) NOT NULL,
  descricao TEXT,
  ncm VARCHAR(20),
  cest VARCHAR(20),
  tipo_produto VARCHAR(100),
  origem VARCHAR(100),
  unidade_medida VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cada código de produto é único por empresa
  UNIQUE(empresa_id, codigo)
);

-- Índice para busca rápida por NCM (para a lógica de dedução de CEST)
CREATE INDEX IF NOT EXISTS idx_memoria_fiscal_ncm ON memoria_fiscal(empresa_id, ncm);

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_memoria_fiscal_codigo ON memoria_fiscal(empresa_id, codigo);
