import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { empresa_id, tipo } = await req.json()

    if (!empresa_id || !tipo) {
      return NextResponse.json({ error: 'empresa_id e tipo são obrigatórios' }, { status: 400 })
    }

    // Buscar o agendamento
    const { data: agendamento, error } = await supabaseAdmin
      .from('agendamentos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .eq('tipo', tipo)
      .single()
      
    if (error) throw new Error('Agendamento não encontrado')

    const { acao } = agendamento
    let logDetalhes: any = { importados: 0, enviados: 0, erros_envio: 0 }
    let statusAgendamento = 'sucesso'

    const baseUrl = req.nextUrl.origin

    try {
      const importReqBody = {
        empresa_id,
        periodoDias: agendamento.periodo_dias,
        tipoPeriodo: agendamento.tipo_periodo,
        situacao: agendamento.situacao,
        statusPagamento: agendamento.status_pagamento,
        localPagamento: agendamento.local_pagamento,
        filtroTipoItens: agendamento.filtro_tipo_itens
      }

      // --- AÇÃO: IMPORTAR ---
      if (acao === 'importar' || acao === 'importar_e_enviar') {
        const importRoute = tipo === 'contas_pagar' ? '/api/datacar/buscar-contas' : '/api/datacar/buscar-vendas'
        
        const importRes = await fetch(`${baseUrl}${importRoute}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importReqBody)
        })
        
        const importData = await importRes.json()
        if (!importRes.ok) throw new Error(importData.error || 'Erro na importação')
        
        logDetalhes.importados = importData.processados || importData.total || 0
      }

      // --- AÇÃO: ENVIAR ---
      if (acao === 'enviar' || acao === 'importar_e_enviar') {
        const enviarRoute = tipo === 'contas_pagar' ? '/api/conta-azul/enviar' : '/api/conta-azul/enviar-vendas'
        
        const enviarRes = await fetch(`${baseUrl}${enviarRoute}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa_id, limite: 100 })
        })
        
        const enviarData = await enviarRes.json()
        if (!enviarRes.ok) throw new Error(enviarData.error || 'Erro no envio')
        
        logDetalhes.enviados = enviarData.sucessos || enviarData.processados || 0
        logDetalhes.erros_envio = enviarData.erros || 0
        
        if (logDetalhes.erros_envio > 0) statusAgendamento = 'parcial'
      }

    } catch (e: any) {
      statusAgendamento = 'erro'
      logDetalhes.erro = e.message
    }

    // Salvar histórico e atualizar último status
    await supabaseAdmin.from('logs_agendamento').insert({
      agendamento_id: agendamento.id,
      empresa_id,
      tipo,
      status: statusAgendamento,
      total_importados: logDetalhes.importados || 0,
      total_enviados: logDetalhes.enviados || 0,
      total_erros: logDetalhes.erros_envio || 0,
      detalhes: logDetalhes
    })

    await supabaseAdmin.from('agendamentos').update({
      ultima_execucao: new Date().toISOString(),
      ultimo_status: statusAgendamento,
      ultimo_log: logDetalhes
    }).eq('id', agendamento.id)

    return NextResponse.json({ message: 'Teste executado', status: statusAgendamento, detalhes: logDetalhes })
  } catch (err: any) {
    console.error('Erro na execução do teste:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
