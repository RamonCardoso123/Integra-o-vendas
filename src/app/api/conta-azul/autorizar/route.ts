import { NextRequest, NextResponse } from 'next/server'
import { getUrlAutorizacao } from '@/lib/conta-azul/api'

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
      error: 'Integração com Conta Azul não configurada. Configure CONTA_AZUL_CLIENT_ID e CONTA_AZUL_REDIRECT_URI no ambiente.'
    }, { status: 500 })
  }

  const url = getUrlAutorizacao(clientId, redirectUri, empresaId)
  return NextResponse.redirect(url)
}
