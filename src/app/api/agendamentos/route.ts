import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Buscar agendamento
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresa_id = searchParams.get('empresa_id')
    const tipo = searchParams.get('tipo')

    if (!empresa_id || !tipo) {
      return NextResponse.json({ error: 'empresa_id e tipo são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('tipo', tipo)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado (ok, retornamos nulo)
      throw error
    }

    return NextResponse.json({ data: data || null })
  } catch (err: any) {
    console.error('Erro GET agendamentos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Salvar/Atualizar agendamento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      empresa_id, tipo, ativo, acao, horario, dias_semana,
      periodo_dias, tipo_periodo, situacao,
      status_pagamento, local_pagamento, filtro_tipo_itens
    } = body

    if (!empresa_id || !tipo) {
      return NextResponse.json({ error: 'empresa_id e tipo são obrigatórios' }, { status: 400 })
    }

    const payload = {
      empresa_id,
      tipo,
      ativo: ativo ?? false,
      acao: acao || 'importar_e_enviar',
      horario: horario || '22:00',
      dias_semana: dias_semana || ['1','2','3','4','5'],
      periodo_dias: periodo_dias || 7,
      tipo_periodo: tipo_periodo || 'venc',
      situacao: situacao || 'todas',
      status_pagamento: status_pagamento || 'todas',
      local_pagamento: local_pagamento || 'todos',
      filtro_tipo_itens: filtro_tipo_itens || 'tudo',
    }

    const { data, error } = await supabaseAdmin
      .from('agendamentos')
      .upsert(payload, { onConflict: 'empresa_id,tipo' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Erro POST agendamentos:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
