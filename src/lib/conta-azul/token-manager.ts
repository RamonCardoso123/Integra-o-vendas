/**
 * Gerenciador centralizado de tokens OAuth do Conta Azul.
 * 
 * Substitui o bloco duplicado de ~20 linhas que existia em cada rota de API.
 * Responsável por:
 *  1. Buscar a empresa no banco (Supabase)
 *  2. Verificar se o access_token está prestes a expirar (margem de 5 min)
 *  3. Se expirado, renovar via refresh_token e salvar os novos tokens
 *  4. Retornar o accessToken válido
 */

import { createClient } from '@supabase/supabase-js'
import { refreshToken } from './api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Erro específico de token para tratamento nas rotas */
export class TokenError extends Error {
  public statusCode: number
  constructor(message: string, statusCode = 401) {
    super(message)
    this.name = 'TokenError'
    this.statusCode = statusCode
  }
}

export interface ValidTokenResult {
  accessToken: string
  empresa: Record<string, any>
}

/**
 * Obtém um token de acesso válido para a empresa especificada.
 * Se o token estiver expirado (ou a menos de 5 min de expirar), 
 * renova automaticamente usando o refresh_token.
 * 
 * @param empresaId - UUID da empresa no Supabase
 * @returns O accessToken válido e os dados da empresa
 * @throws TokenError se a empresa não existe, não tem token, ou não consegue renovar
 */
export async function getValidToken(empresaId: string): Promise<ValidTokenResult> {
  // 1. Buscar empresa
  const { data: empresa, error: errEmp } = await supabaseAdmin
    .from('empresas')
    .select('*')
    .eq('id', empresaId)
    .single()

  if (errEmp || !empresa) {
    throw new TokenError('Empresa não encontrada', 404)
  }

  if (!empresa.access_token_conta_azul) {
    throw new TokenError('Empresa não está conectada ao Conta Azul. Acesse Configurações e clique em "Conectar Conta Azul".', 401)
  }

  // 2. Verificar expiração (margem de 5 minutos)
  let accessToken = empresa.access_token_conta_azul
  const expiracao = empresa.data_expiracao_token ? new Date(empresa.data_expiracao_token) : null
  const agora = new Date()
  const tokenExpirado = expiracao && expiracao <= new Date(agora.getTime() + 5 * 60 * 1000)

  // 3. Renovar se necessário
  if (tokenExpirado && empresa.refresh_token_conta_azul) {
    try {
      const novosTokens = await refreshToken(
        empresa.refresh_token_conta_azul,
        process.env.CONTA_AZUL_CLIENT_ID!,
        process.env.CONTA_AZUL_CLIENT_SECRET!
      )
      accessToken = novosTokens.access_token

      const { error: errUpdate } = await supabaseAdmin
        .from('empresas')
        .update({
          access_token_conta_azul: novosTokens.access_token,
          refresh_token_conta_azul: novosTokens.refresh_token || empresa.refresh_token_conta_azul,
          data_expiracao_token: new Date(Date.now() + (novosTokens.expires_in || 3600) * 1000).toISOString(),
        })
        .eq('id', empresaId)

      if (errUpdate) {
        console.error('[token-manager] Falha ao salvar novos tokens:', errUpdate.message)
        // Não bloqueia — o token novo ainda é válido para esta requisição
      }

      console.log(`[token-manager] Token renovado com sucesso para empresa ${empresa.nome || empresaId}`)
    } catch (errRefresh) {
      console.error('[token-manager] Falha ao renovar token:', errRefresh)
      throw new TokenError(
        'Sua conexão com a Conta Azul expirou. Por favor, acesse as Configurações e clique em "Conectar Conta Azul" novamente.',
        401
      )
    }
  }

  return { accessToken, empresa }
}
