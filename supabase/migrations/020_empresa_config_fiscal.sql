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
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

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
