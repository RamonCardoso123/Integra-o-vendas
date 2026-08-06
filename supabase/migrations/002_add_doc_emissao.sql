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
