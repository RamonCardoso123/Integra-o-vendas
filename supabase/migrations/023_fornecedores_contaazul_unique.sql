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
