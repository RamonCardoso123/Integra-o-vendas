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
