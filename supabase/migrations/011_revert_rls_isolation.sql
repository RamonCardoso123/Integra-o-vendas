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
