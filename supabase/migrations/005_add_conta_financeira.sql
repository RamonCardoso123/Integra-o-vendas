-- Adiciona coluna de conta financeira para suportar a seleção de conta de pagamento
ALTER TABLE contas_pagar_importadas ADD COLUMN IF NOT EXISTS conta_financeira TEXT;

-- Comentário para documentação
COMMENT ON COLUMN contas_pagar_importadas.conta_financeira IS 'Nome da conta financeira (banco/caixa) para o lançamento no Conta Azul';
