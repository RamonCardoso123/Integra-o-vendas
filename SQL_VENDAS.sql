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
-- ============================================================
-- Migration 002: Adiciona colunas doc e emissao
-- Necessário para armazenar o número do documento (NF/DOC)
-- e a data de emissão vindos do Datacar
-- ============================================================

ALTER TABLE public.contas_pagar_importadas
  ADD COLUMN IF NOT EXISTS doc     TEXT,
  ADD COLUMN IF NOT EXISTS emissao DATE;

-- Atualizar constraint de upsert para incluir o doc
-- (o upsert na aplicação usa: empresa_id, fornecedor, valor, vencimento, doc)
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
-- Adiciona coluna created_by para facilitar RLS na criação
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Atualiza políticas de Empresas
DROP POLICY IF EXISTS "usuarios_inserem_empresas" ON public.empresas;
CREATE POLICY "usuarios_inserem_empresas" ON public.empresas 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_veem_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_veem_suas_empresas" ON public.empresas 
  FOR SELECT USING (
    created_by = auth.uid() OR 
    id IN (SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "usuarios_atualizam_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_atualizam_suas_empresas" ON public.empresas 
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    id IN (SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid() AND papel = 'admin')
  );
-- Adiciona coluna de conta financeira para suportar a seleção de conta de pagamento
ALTER TABLE contas_pagar_importadas ADD COLUMN IF NOT EXISTS conta_financeira TEXT;

-- Comentário para documentação
COMMENT ON COLUMN contas_pagar_importadas.conta_financeira IS 'Nome da conta financeira (banco/caixa) para o lançamento no Conta Azul';
-- ============================================================
-- Migration 006: Adiciona email_login na tabela empresas
-- Campo opcional para vincular o e-mail de login do Conta Azul
-- a cada empresa, permitindo avisar quando o login ativo
-- não corresponde à empresa selecionada para envio.
--
-- SEGURO: usa ADD COLUMN IF NOT EXISTS + nullable sem default
-- Não altera nenhuma coluna existente, não remove nada.
-- ============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS email_login TEXT;

COMMENT ON COLUMN public.empresas.email_login IS
  'E-mail de login usado no Conta Azul para esta empresa.
   Usado para avisar quando o usuário logado é diferente
   do responsável pela empresa no Conta Azul.';
-- Adiciona coluna conta_financeira_id para guardar o UUID da conta no Conta Azul
-- Isso permite o envio direto por ID, sem precisar de match por nome
ALTER TABLE contas_pagar_importadas ADD COLUMN IF NOT EXISTS conta_financeira_id TEXT;

COMMENT ON COLUMN contas_pagar_importadas.conta_financeira_id IS 'UUID da conta financeira no Conta Azul — usado para envio direto sem match por nome';
ALTER TABLE contas_pagar_importadas ADD COLUMN IF NOT EXISTS fornecedor_id TEXT;
-- ============================================================
-- Migration 011: REVERTER isolamento de empresas por usuário
-- Restaura as políticas originais de segurança (RLS).
-- ============================================================

-- 1. Empresas
DROP POLICY IF EXISTS "usuarios_veem_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_veem_suas_empresas" ON public.empresas 
  FOR SELECT USING (
    created_by = auth.uid() OR 
    id IN (SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "usuarios_atualizam_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_atualizam_suas_empresas" ON public.empresas 
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    id IN (SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid() AND papel = 'admin')
  );

-- 2. Contas a Pagar
DROP POLICY IF EXISTS "contas_pagar_por_empresa" ON public.contas_pagar_importadas;
CREATE POLICY "contas_pagar_por_empresa" ON public.contas_pagar_importadas 
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- 3. Importações
DROP POLICY IF EXISTS "importacoes_por_empresa" ON public.importacoes;
CREATE POLICY "importacoes_por_empresa" ON public.importacoes 
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- 4. Logs
DROP POLICY IF EXISTS "logs_por_empresa" ON public.logs_integracao;
CREATE POLICY "logs_por_empresa" ON public.logs_integracao 
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- 5. Fornecedores Conta Azul
DROP POLICY IF EXISTS "usuarios_veem_fornecedores_da_empresa" ON public.fornecedores_contaazul;
CREATE POLICY "usuarios_veem_fornecedores_da_empresa" ON public.fornecedores_contaazul 
  FOR ALL USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
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
-- ============================================================
-- Adiciona a coluna tipo_empresa para separar empresas de Vendas e Contas a Pagar/Receber
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tipo_empresa TEXT DEFAULT 'ambos' 
CHECK (tipo_empresa IN ('vendas', 'financeiro', 'ambos'));
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
-- ============================================================
-- Adiciona coluna metadata nas tabelas de importação para armazenar 
-- dados extras do Datacar (como CPF/CNPJ, etc)
-- ============================================================

ALTER TABLE public.contas_pagar_importadas ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendas_importadas ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- ============================================================
-- BPO FINANCEIRO - Migration: Unique Constraints para Importadas
-- ============================================================

-- Garante que valores NULL no campo 'doc' de contas a pagar sejam considerados duplicados se a mesma conta for reimportada.
-- Para isso, vamos usar COALESCE no unique index, ou substituir temporariamente para uma string vazia antes do upsert no codigo.
-- Mas como o onConflict requer constraint no supabase, adicionamos unique na tabela.
-- Como postgres considera NULLs diferentes, faremos com que a constraint cubra os campos principais e vamos forçar 'doc' a ser '' no frontend.

-- Vendas
ALTER TABLE public.vendas_importadas DROP CONSTRAINT IF EXISTS vendas_importadas_empresa_id_os_numero_key;
ALTER TABLE public.vendas_importadas ADD CONSTRAINT vendas_importadas_empresa_id_os_numero_key UNIQUE (empresa_id, os_numero);

-- Contas a Pagar
ALTER TABLE public.contas_pagar_importadas DROP CONSTRAINT IF EXISTS contas_pagar_importadas_unique_key;
ALTER TABLE public.contas_pagar_importadas ADD CONSTRAINT contas_pagar_importadas_unique_key UNIQUE (empresa_id, fornecedor, valor, vencimento, doc);
-- ============================================================
-- Adiciona a coluna categoria na tabela contas_pagar_importadas
-- para possibilitar salvar a categoria vinda do Datacar ou Planilha
-- ============================================================

ALTER TABLE public.contas_pagar_importadas ADD COLUMN IF NOT EXISTS categoria TEXT;
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
-- Tabela de Configurações Fiscais e Armazenamento Criptografado da Senha
CREATE TABLE IF NOT EXISTS public.empresa_config_fiscal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cnpj VARCHAR(14),
    inscricao_municipal VARCHAR(50),
    regime_tributario INTEGER DEFAULT 1, -- 1=Simples, 2=Presumido, etc
    
    -- Dados do Certificado A1
    certificado_nome_arquivo VARCHAR(255),
    certificado_storage_path VARCHAR(255),
    certificado_senha_encriptada TEXT,
    certificado_iv TEXT, -- Initialization Vector do AES
    certificado_validade DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(empresa_id)
);

-- Ativar RLS
ALTER TABLE public.empresa_config_fiscal ENABLE ROW LEVEL SECURITY;

-- Políticas da tabela
CREATE POLICY "Acesso as configuracoes da propria empresa"
    ON public.empresa_config_fiscal
    FOR ALL
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_empresas 
            WHERE user_id = auth.uid()
        )
    );

-- Trigger de updated_at
CREATE TRIGGER update_empresa_config_fiscal_modtime
BEFORE UPDATE ON public.empresa_config_fiscal
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Criar bucket seguro para os certificados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificados_fiscais', 'certificados_fiscais', false, 10485760, ARRAY['application/x-pkcs12', 'application/pkcs12', 'application/octet-stream', 'application/x-x509-ca-cert'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- RLS do Bucket (Apenas upload pelo usuário autenticado ou acesso pelo backend/service_role)
-- Permite que usuários insiram no bucket (vamos assumir que a app fará upload com auth)
CREATE POLICY "Permitir upload de certificado para usuario autenticado"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificados_fiscais');

-- Permite leitura e update do seu próprio certificado
CREATE POLICY "Permitir gerenciar proprio certificado"
ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'certificados_fiscais');

-- ============================================================
-- BPO FINANCEIRO - Migration: Adiciona alíquotas fiscais
-- ============================================================

ALTER TABLE public.empresa_config_fiscal
ADD COLUMN IF NOT EXISTS aliquota_simples_nacional NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS aliquota_issqn NUMERIC(5,2);

-- ============================================================
-- Fim
-- ============================================================
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
-- ============================================================
-- Migration 023: Corrigida - Remove duplicatas e cria índice único
-- ============================================================

-- 1. Adicionar campo categoria_padrao se ainda não existir
ALTER TABLE public.fornecedores_contaazul
  ADD COLUMN IF NOT EXISTS categoria_padrao TEXT;

-- 2. Remover duplicatas mantendo apenas 1 registro por (empresa_id, nome_normalizado)
--    Prioriza: quem tem categoria_padrao preenchida, depois o mais recente (maior id)
DELETE FROM public.fornecedores_contaazul
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY empresa_id, nome_normalizado
        ORDER BY
          CASE WHEN categoria_padrao IS NOT NULL THEN 0 ELSE 1 END, -- prefere quem tem categoria
          created_at DESC -- depois o mais recente
      ) AS rn
    FROM public.fornecedores_contaazul
  ) ranked
  WHERE rn > 1
);

-- 3. Criar índice ÚNICO (agora sem duplicatas, deve funcionar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_empresa_nome
  ON public.fornecedores_contaazul(empresa_id, nome_normalizado);
-- ============================================================
-- Migration 024: Corrige RLS da tabela fornecedor_depara
-- A política anterior (FOR ALL USING) não tinha WITH CHECK,
-- o que bloqueava INSERT/UPSERT pelo client-side Supabase.
-- ============================================================

-- Remove a política antiga
DROP POLICY IF EXISTS "usuarios_veem_depara_da_empresa" ON public.fornecedor_depara;

-- Cria política de SELECT (leitura)
CREATE POLICY "depara_select" ON public.fornecedor_depara
  FOR SELECT USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- Cria política de INSERT com WITH CHECK
CREATE POLICY "depara_insert" ON public.fornecedor_depara
  FOR INSERT WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- Cria política de UPDATE
CREATE POLICY "depara_update" ON public.fornecedor_depara
  FOR UPDATE USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );

-- Cria política de DELETE
CREATE POLICY "depara_delete" ON public.fornecedor_depara
  FOR DELETE USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios_empresas
      WHERE user_id = auth.uid()
    )
  );
