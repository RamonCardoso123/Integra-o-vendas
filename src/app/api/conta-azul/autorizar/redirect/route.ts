import { NextRequest, NextResponse } from 'next/server'
import { getUrlAutorizacao } from '@/lib/conta-azul/api'

/**
 * Rota intermediária do fluxo de 2 passos para troca de conta na Conta Azul.
 * 
 * PROBLEMA ORIGINAL:
 * Quando o usuário já estava logado na Empresa A e tentava conectar a Empresa B,
 * o Cognito reaproveitava a sessão anterior e fazia auto-login com a conta da Empresa A.
 * 
 * SOLUÇÃO:
 * 1. /api/conta-azul/autorizar → redireciona para auth.contaazul.com/logout
 * 2. O logout do Cognito limpa os cookies e redireciona para ESTA rota
 * 3. ESTA rota redireciona para auth.contaazul.com/oauth2/authorize (tela de login limpa)
 * 
 * Dessa forma, a sessão antiga é destruída ANTES de abrir a tela de login nova.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresaId = searchParams.get('empresa_id')

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  const clientId = process.env.CONTA_AZUL_CLIENT_ID
  const redirectUri = process.env.CONTA_AZUL_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({
      error: 'Integração com Conta Azul não configurada.'
    }, { status: 500 })
  }

  // Agora sim, com a sessão limpa, redireciona para a tela de autorização/login
  const url = getUrlAutorizacao(clientId, redirectUri, empresaId)

  return NextResponse.redirect(url)
}
