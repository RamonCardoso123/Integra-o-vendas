import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { testarConexao } from '@/services/datacar/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Testa a conexão com o Datacar usando as credenciais da empresa */
export async function POST(req: NextRequest) {
  try {
    const { empresa_id } = await req.json()

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
    }

    const { data: empresa, error } = await supabaseAdmin
      .from('empresas')
      .select('datacar_token, datacar_cod_emp, datacar_id_operador')
      .eq('id', empresa_id)
      .single()

    if (error || !empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    if (!empresa.datacar_token || !empresa.datacar_cod_emp || !empresa.datacar_id_operador) {
      return NextResponse.json({ error: 'Credenciais do Datacar não configuradas para esta empresa' }, { status: 400 })
    }

    const resultado = await testarConexao({
      token: empresa.datacar_token,
      codEmp: empresa.datacar_cod_emp,
      idOperador: empresa.datacar_id_operador,
    })

    return NextResponse.json(resultado)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
