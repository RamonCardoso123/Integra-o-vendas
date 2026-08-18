-- ============================================================
-- Migration 026: Adicionar política de RLS para exclusão de empresas
-- Permite que o criador da empresa ou usuários administradores da
-- mesma possam deletá-la via API (Supabase Client).
-- ============================================================

DROP POLICY IF EXISTS "usuarios_deletam_suas_empresas" ON public.empresas;
CREATE POLICY "usuarios_deletam_suas_empresas" ON public.empresas 
  FOR DELETE USING (
    created_by = auth.uid() OR 
    id IN (SELECT empresa_id FROM public.usuarios_empresas WHERE user_id = auth.uid() AND papel = 'admin')
  );
