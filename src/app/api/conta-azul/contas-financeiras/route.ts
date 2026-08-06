import { NextRequest, NextResponse } from 'next/server'
import { listarContasFinanceiras } from '@/lib/conta-azul/api'
import { getValidToken, TokenError } from '@/lib/conta-azul/token-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
  }

  // Obter token válido (com renovação automática)
  let accessToken: string
  try {
    const result = await getValidToken(empresa_id)
    accessToken = result.accessToken
  } catch (e) {
    if (e instanceof TokenError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw e
  }

  try {
    const contas = await listarContasFinanceiras(accessToken)
    return NextResponse.json({ contas })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar contas' }, { status: 500 })
  }
}
