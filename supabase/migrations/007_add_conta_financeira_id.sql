-- Adiciona coluna conta_financeira_id para guardar o UUID da conta no Conta Azul
-- Isso permite o envio direto por ID, sem precisar de match por nome
ALTER TABLE contas_pagar_importadas ADD COLUMN IF NOT EXISTS conta_financeira_id TEXT;

COMMENT ON COLUMN contas_pagar_importadas.conta_financeira_id IS 'UUID da conta financeira no Conta Azul — usado para envio direto sem match por nome';
