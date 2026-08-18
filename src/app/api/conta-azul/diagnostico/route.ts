import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken, TokenError } from '@/lib/conta-azul/token-manager'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://api-v2.contaazul.com/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get('empresa_id')

  const envs = {
    CONTA_AZUL_CLIENT_ID: process.env.CONTA_AZUL_CLIENT_ID ? `Prefixo: ${process.env.CONTA_AZUL_CLIENT_ID.substring(0, 4)}... (Tamanho: ${process.env.CONTA_AZUL_CLIENT_ID.length})` : 'NÃO CONFIGURADO',
    CONTA_AZUL_CLIENT_SECRET: process.env.CONTA_AZUL_CLIENT_SECRET ? `Prefixo: ${process.env.CONTA_AZUL_CLIENT_SECRET.substring(0, 4)}... (Tamanho: ${process.env.CONTA_AZUL_CLIENT_SECRET.length})` : 'NÃO CONFIGURADO',
    CONTA_AZUL_REDIRECT_URI: process.env.CONTA_AZUL_REDIRECT_URI || 'NÃO CONFIGURADO',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NÃO CONFIGURADO'
  }

  if (!empresa_id) {
    const { data: empresas } = await supabaseAdmin
      .from('empresas')
      .select('id, nome, cnpj, conta_azul_connected, access_token_conta_azul, refresh_token_conta_azul, data_expiracao_token')
      .limit(20)
    
    const empresasFormatadas = empresas?.map(e => ({
      id: e.id,
      nome: e.nome,
      cnpj: e.cnpj,
      conta_azul_connected: e.conta_azul_connected,
      has_access_token: !!e.access_token_conta_azul,
      has_refresh_token: !!e.refresh_token_conta_azul,
      data_expiracao_token: e.data_expiracao_token
    }))
    
    return NextResponse.json({ 
      instrucao: 'Selecione uma empresa abaixo e use ?empresa_id=ID na URL',
      variaveis_ambiente: envs,
      empresas: empresasFormatadas 
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
    '/pessoas/conta-conectada',
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
