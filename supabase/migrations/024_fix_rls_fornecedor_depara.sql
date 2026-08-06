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
