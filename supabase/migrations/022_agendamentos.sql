-- ============================================================
-- BPO FINANCEIRO - Migration: Agendamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('contas_pagar', 'vendas')),
  ativo BOOLEAN DEFAULT false,
  acao TEXT DEFAULT 'importar_e_enviar' CHECK (acao IN ('importar', 'enviar', 'importar_e_enviar')),
  horario TEXT DEFAULT '22:00',
  dias_semana TEXT[] DEFAULT '{1,2,3,4,5}',
  
  -- Parâmetros da busca
  periodo_dias INTEGER DEFAULT 7,
  tipo_periodo TEXT DEFAULT 'venc',
  situacao TEXT DEFAULT 'todas',
  status_pagamento TEXT DEFAULT 'todas',
  local_pagamento TEXT DEFAULT 'todos',
  filtro_tipo_itens TEXT DEFAULT 'tudo',
  
  -- Controle de execução  
  ultima_execucao TIMESTAMPTZ,
  ultimo_status TEXT CHECK (ultimo_status IN ('sucesso', 'erro', 'parcial', NULL)),
  ultimo_log JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(empresa_id, tipo)
);

CREATE TRIGGER set_updated_at_agendamentos
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.logs_agendamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'parcial')),
  total_importados INTEGER DEFAULT 0,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  detalhes JSONB,
  executado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_id ON public.agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_agendamento_empresa_id ON public.logs_agendamento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_agendamento_agendamento_id ON public.logs_agendamento(agendamento_id);

-- RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_agendamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agendamentos_por_empresa"
  ON public.agendamentos FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "logs_agendamento_por_empresa"
  ON public.logs_agendamento FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
