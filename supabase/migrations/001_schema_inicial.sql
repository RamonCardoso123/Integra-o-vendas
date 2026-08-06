-- ============================================================
-- BPO FINANCEIRO - Schema Inicial
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: empresas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                        TEXT NOT NULL,
  cnpj                        TEXT NOT NULL,
  access_token_conta_azul     TEXT,
  refresh_token_conta_azul    TEXT,
  data_expiracao_token        TIMESTAMPTZ,
  conta_azul_connected        BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: usuarios_empresas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usuarios_empresas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel       TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin', 'operador', 'visualizador')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, empresa_id)
);

-- ============================================================
-- TABELA: contas_pagar_importadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contas_pagar_importadas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fornecedor      TEXT NOT NULL,
  valor           NUMERIC(15, 2) NOT NULL,
  vencimento      DATE NOT NULL,
  descricao       TEXT,
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'enviado', 'erro', 'cancelado')),
  conta_azul_id   TEXT,
  erro_mensagem   TEXT,
  tentativas      INTEGER DEFAULT 0,
  importacao_id   UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: importacoes (controle de lotes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.importacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  nome_arquivo    TEXT NOT NULL,
  tipo_arquivo    TEXT NOT NULL CHECK (tipo_arquivo IN ('xlsx', 'csv', 'pdf', 'imagem')),
  total_registros INTEGER DEFAULT 0,
  enviados        INTEGER DEFAULT 0,
  erros           INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'importado' CHECK (status IN ('importado', 'processando', 'concluido', 'erro')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: logs_integracao
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs_integracao (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_pagar_id  UUID REFERENCES public.contas_pagar_importadas(id) ON DELETE SET NULL,
  importacao_id   UUID REFERENCES public.importacoes(id) ON DELETE SET NULL,
  acao            TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'info')),
  detalhes        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_empresas
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_contas_pagar
  BEFORE UPDATE ON public.contas_pagar_importadas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_user_id ON public.usuarios_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresas_empresa_id ON public.usuarios_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_id ON public.contas_pagar_importadas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar_importadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar_importadas(vencimento);
CREATE INDEX IF NOT EXISTS idx_logs_empresa_id ON public.logs_integracao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_empresa_id ON public.importacoes(empresa_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar_importadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_integracao ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas empresas às quais está vinculado
CREATE POLICY "usuarios_veem_suas_empresas"
  ON public.empresas FOR SELECT
  USING (
    id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "usuarios_atualizam_suas_empresas"
  ON public.empresas FOR UPDATE
  USING (
    id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid() AND papel = 'admin'
    )
  );

CREATE POLICY "usuarios_inserem_empresas"
  ON public.empresas FOR INSERT
  WITH CHECK (true);

-- Vínculo usuário-empresa
CREATE POLICY "usuarios_veem_seus_vinculos"
  ON public.usuarios_empresas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "usuarios_inserem_vinculos"
  ON public.usuarios_empresas FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Contas a pagar: usuário acessa apenas contas de suas empresas
CREATE POLICY "contas_pagar_por_empresa"
  ON public.contas_pagar_importadas FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- Importações
CREATE POLICY "importacoes_por_empresa"
  ON public.importacoes FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- Logs
CREATE POLICY "logs_por_empresa"
  ON public.logs_integracao FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "logs_insert_service"
  ON public.logs_integracao FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- DADOS INICIAIS DE EXEMPLO (opcional - remova se não quiser)
-- ============================================================
-- Para criar sua primeira empresa após logar, use a interface do app
