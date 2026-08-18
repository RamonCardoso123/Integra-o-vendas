import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const diagnosticInfo = {
    env_url_prefix: url.substring(0, 30),
    env_service_key_prefix: key.substring(0, 20) + '...',
    env_anon_key_prefix: anon.substring(0, 20) + '...',
    service_key_length: key.length,
    anon_key_length: anon.length,
    status_inicial: null as any,
    update_resultado: null as any,
    status_final: null as any
  }

  const supabaseAdmin = createClient(url, key)

  try {
    // 1. Busca a empresa NUFAST BARÃO
    const { data: empresaInicial, error: errBusca } = await supabaseAdmin
      .from('empresas')
      .select('*')
      .eq('nome', 'NUFAST BARÃO')
      .single()

    diagnosticInfo.status_inicial = {
      erro: errBusca ? { message: errBusca.message, code: errBusca.code } : null,
      empresa: empresaInicial ? {
        id: empresaInicial.id,
        nome: empresaInicial.nome,
        cnpj: empresaInicial.cnpj,
        conta_azul_connected: empresaInicial.conta_azul_connected,
        has_access_token: !!empresaInicial.access_token_conta_azul,
        has_refresh_token: !!empresaInicial.refresh_token_conta_azul
      } : null
    }

    if (empresaInicial) {
      // 2. Tenta forçar o update da flag conta_azul_connected para true e gravar tokens fictícios
      const { data: dataUpdate, error: errUpdate } = await supabaseAdmin
        .from('empresas')
        .update({
          conta_azul_connected: true,
          access_token_conta_azul: 'teste_access_token_vercel',
          refresh_token_conta_azul: 'teste_refresh_token_vercel',
          data_expiracao_token: new Date(Date.now() + 86400 * 1000).toISOString()
        })
        .eq('id', empresaInicial.id)
        .select()

      diagnosticInfo.update_resultado = {
        erro: errUpdate ? { message: errUpdate.message, code: errUpdate.code } : null,
        data: dataUpdate
      }

      // 3. Busca novamente para ver se gravou no banco
      const { data: empresaFinal } = await supabaseAdmin
        .from('empresas')
        .select('*')
        .eq('id', empresaInicial.id)
        .single()

      diagnosticInfo.status_final = {
        empresa: empresaFinal ? {
          id: empresaFinal.id,
          nome: empresaFinal.nome,
          conta_azul_connected: empresaFinal.conta_azul_connected
        } : null
      }
    }

    return NextResponse.json(diagnosticInfo)
  } catch (err: any) {
    return NextResponse.json({
      erro_exception: err.message,
      stack: err.stack,
      diagnosticInfo
    }, { status: 500 })
  }
}
