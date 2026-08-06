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
