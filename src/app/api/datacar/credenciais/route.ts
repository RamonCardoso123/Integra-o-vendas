import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Salva/atualiza credenciais do Datacar para uma empresa */
export async function POST(req: NextRequest) {
  try {
    const { empresa_id, datacar_token, datacar_cod_emp, datacar_id_operador } = await req.json()

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('empresas')
      .update({
        datacar_token: datacar_token || null,
        datacar_cod_emp: datacar_cod_emp || null,
        datacar_id_operador: datacar_id_operador || null,
      })
      .eq('id', empresa_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Credenciais salvas com sucesso!' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
