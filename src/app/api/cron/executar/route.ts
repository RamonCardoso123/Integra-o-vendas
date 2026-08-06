import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getHoraBrasilia(): string {
  const date = new Date()
  const dtf = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return dtf.format(date) // "22:00"
}

function getDiaDaSemanaBrasilia(): string {
  const date = new Date()
  // Melhor abordagem manual:
  const offset = -3 // BRT approx (sem h de verão)
  const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000))
  const brDate = new Date(utcDate.getTime() + (offset * 3600000))
  
  // getDay(): 0 = Dom, 1 = Seg...
  // Nosso BD usa 1=Seg...7=Dom.
  let dia = brDate.getDay()
  if (dia === 0) dia = 7
  return dia.toString()
}

export async function GET(req: NextRequest) {
  try {
    // 1. Validar Segurança
    // A Vercel envia Authorization: Bearer <CRON_SECRET>
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Desativando validação rígida caso estejamos testando sem o env configurado.
    // O ideal é sempre ter o CRON_SECRET no painel da Vercel.
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Identificar a hora atual no Brasil
    const horaAtual = getHoraBrasilia()
    const diaAtual = getDiaDaSemanaBrasilia()
    
    // Buscar todos os agendamentos ativos
    const { data: agendamentos, error } = await supabaseAdmin
      .from('agendamentos')
      .select('*')
      .eq('ativo', true)
      
    if (error) throw error

    // Filtrar apenas os que devem rodar AGORA (mesma hora, e contêm o dia de hoje)
    // Extrai apenas a hora ("22:00" -> "22", para ser flexível caso atrase uns minutos)
    const horaAtualHora = horaAtual.split(':')[0]
    
    const agendamentosValidos = agendamentos.filter(a => {
      if (!a.dias_semana || !a.dias_semana.includes(diaAtual)) return false
      if (!a.horario) return false
      
      const horaAgendadaHora = a.horario.split(':')[0]
      return horaAgendadaHora === horaAtualHora
    })

    if (agendamentosValidos.length === 0) {
      return NextResponse.json({ message: 'Nenhum agendamento para esta hora', horaAtual, diaAtual })
    }

    // 3. Executar cada agendamento
    const resultados = []
    
    // Criar host base para fetch interno
    // Em Vercel, req.nextUrl.origin funciona bem.
    const baseUrl = req.nextUrl.origin

    for (const agendamento of agendamentosValidos) {
      const { empresa_id, tipo, acao } = agendamento
      let logDetalhes: any = { importados: 0, enviados: 0, erros_envio: 0 }
      let statusAgendamento = 'sucesso'

      try {
        const importReqBody = {
          empresa_id,
          periodoDias: agendamento.periodo_dias,
          tipoPeriodo: agendamento.tipo_periodo,
          situacao: agendamento.situacao,
          // campos extras de vendas ou contas podem ser passados
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
            body: JSON.stringify({ empresa_id, limite: 100 }) // Processar até 100 por vez
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

      // 4. Salvar histórico e atualizar último status
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

      resultados.push({ empresa_id, tipo, status: statusAgendamento })
    }

    return NextResponse.json({ message: 'Executado com sucesso', resultados })
  } catch (err: any) {
    console.error('Erro na execução do Cron:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
