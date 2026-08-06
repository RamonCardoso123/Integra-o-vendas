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
