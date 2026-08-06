import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken, TokenError } from '@/lib/conta-azul/token-manager'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://api-v2.contaazul.com/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')

  if (!empresa_id) {
    const { data: empresas } = await supabaseAdmin
      .from('empresas')
      .select('id, nome')
      .limit(20)
    
    return NextResponse.json({ 
      instrucao: 'Selecione uma empresa abaixo e use ?empresa_id=ID na URL',
      empresas 
    })
  }

  // Obter token válido (com renovação automática)
  let token: string
  let empresaNome: string
  try {
    const result = await getValidToken(empresa_id)
    token = result.accessToken
    empresaNome = result.empresa.nome || empresa_id
  } catch (e) {
    if (e instanceof TokenError) {
      return NextResponse.json({ erro: e.message }, { status: e.statusCode })
    }
    return NextResponse.json({ erro: 'Erro ao obter token' }, { status: 500 })
  }
  const results: any = {
    empresa: empresaNome,
    endpoints_testados: []
  }

  const endpoints = [
    '/financeiro/contas-financeiras',
    '/financeiro/categorias',
    '/categorias',
    '/financeiro/categorias?tipo=DESPESA',
    '/financeiro/categorias-financeiras',
    '/pessoas?tipo=FORNECEDOR',
  ]

  for (const path of endpoints) {
    try {
      const url = `${BASE_URL}${path}`
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      const status = res.status
      const raw = await res.text()
      let json = null
      try { json = JSON.parse(raw) } catch {}

      results.endpoints_testados.push({
        path,
        status,
        response: json || raw.substring(0, 500)
      })
    } catch (e: any) {
      results.endpoints_testados.push({
        path,
        erro: e.message
      })
    }
  }

  return NextResponse.json(results)
}
