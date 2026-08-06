import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── GET: Buscar notas emitidas ─────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresa_id = searchParams.get('empresa_id')
    const tipo = searchParams.get('tipo') || 'servicos' // 'servicos' ou 'produtos'
    const data_inicio = searchParams.get('data_inicio')
    const data_fim = searchParams.get('data_fim')
    const busca = searchParams.get('busca')

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })
    }

    const { getValidToken } = await import('@/lib/conta-azul/token-manager')
    const { accessToken } = await getValidToken(empresa_id)
    const CA_BASE = 'https://api-v2.contaazul.com/v1'
    let vendasFormatadas: any[] = []

    // ────────────────────────────────────────────────────────
    // ABA PRODUTOS: /v1/notas-fiscais
    // ────────────────────────────────────────────────────────
    if (tipo === 'produtos') {
      let url = `${CA_BASE}/notas-fiscais?tamanho_pagina=100`
      if (data_inicio) url += `&data_inicial=${data_inicio}`
      if (data_fim) url += `&data_final=${data_fim}`
      
      console.log('[notas-emitidas] Buscando notas fiscais de PRODUTO:', url)
      
      const resCa = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
      
      if (resCa.ok) {
        const dataCa = await resCa.json()
        let vendas = dataCa.itens || dataCa.items || []
        
        if (busca) {
          const b = busca.toLowerCase()
          vendas = vendas.filter((v: any) => {
            const nomeCliente = v.nome_cliente || v.cliente?.nome || v.customer?.name || ''
            return nomeCliente.toLowerCase().includes(b)
          })
        }

        vendasFormatadas = vendas.map((v: any) => ({
          id: v.id || v.numero?.toString() || Math.random().toString(),
          cliente: v.nome_cliente || v.cliente?.nome || v.customer?.name || 'Cliente CA',
          os_numero: (v.numero || v.serie_numero || v.number || 'S/N').toString(),
          data_venda: v.data_emissao || v.data_venda || v.emission || null,
          valor_total: v.valor_total || v.valor_composicao?.valor_liquido || v.total || 0,
          status: (v.situacao?.nome || v.situacao || v.status || '').toString().toUpperCase().includes('CANCEL') ? 'cancelado' : 'enviado',
          erro_mensagem: 'Sincronizado do Conta Azul',
          conta_azul_id: v.id || v.numero?.toString() || null,
          updated_at: v.data_emissao || new Date().toISOString()
        }))
      } else {
        const errTxt = await resCa.text()
        console.error("[notas-emitidas] Erro CA Produtos:", resCa.status, errTxt)
        return NextResponse.json({ error: `Erro do Conta Azul: ${errTxt}` }, { status: resCa.status })
      }
    }

    // ────────────────────────────────────────────────────────
    // ABA SERVIÇOS: /v1/notas-fiscais-servico
    // ────────────────────────────────────────────────────────
    if (tipo === 'servicos') {
      const dIni = data_inicio ? new Date(`${data_inicio}T00:00:00Z`) : new Date(Date.now() - 30 * 86400000)
      const dFim = data_fim ? new Date(`${data_fim}T23:59:59Z`) : new Date()
      
      const chunks: { inicio: string, fim: string }[] = []
      let atual = new Date(dIni)
      
      while (atual <= dFim) {
        let chunkFim = new Date(atual)
        chunkFim.setDate(chunkFim.getDate() + 14) // 15 dias de janela
        if (chunkFim > dFim) chunkFim = new Date(dFim)
        
        chunks.push({
          inicio: atual.toISOString().split('T')[0],
          fim: chunkFim.toISOString().split('T')[0]
        })
        
        atual.setDate(atual.getDate() + 15)
      }

      let todasVendasServico: any[] = []
      let erroCA = null

      const fetchPromises = chunks.map(async chunk => {
        const url = `${CA_BASE}/notas-fiscais-servico?tamanho_pagina=100&data_competencia_de=${chunk.inicio}&data_competencia_ate=${chunk.fim}`
        console.log('[notas-emitidas] Buscando notas fiscais de SERVICO:', url)
        const resCa = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
        
        if (resCa.ok) {
          const dataCa = await resCa.json()
          return dataCa.itens || dataCa.items || []
        } else {
          const txt = await resCa.text()
          console.error(`[notas-emitidas] Erro CA Servicos chunk ${chunk.inicio}-${chunk.fim}:`, resCa.status, txt)
          erroCA = `Erro ${resCa.status}: ${txt}`
          return []
        }
      })

      const arraysDeVendas = await Promise.all(fetchPromises)
      
      if (erroCA && arraysDeVendas.every(arr => arr.length === 0)) {
        return NextResponse.json({ error: `Erro do Conta Azul: ${erroCA}` }, { status: 400 })
      }
      
      arraysDeVendas.forEach(arr => { todasVendasServico.push(...arr) })

      const vendasUnicas = Array.from(new Map(todasVendasServico.map(item => [item.id || item.numero, item])).values())

      let vendas = vendasUnicas
      if (busca) {
        const b = busca.toLowerCase()
        vendas = vendas.filter((v: any) => {
          const nomeCliente = v.nome_cliente || v.cliente?.nome || v.customer?.name || ''
          return nomeCliente.toLowerCase().includes(b)
        })
      }

      vendasFormatadas = vendas.map((v: any) => ({
        id: v.id || v.numero?.toString() || Math.random().toString(),
        cliente: v.nome_cliente || v.cliente?.nome || v.customer?.name || 'Cliente CA',
        os_numero: (v.numero || v.serie_numero || v.numero_nfse || v.number || 'S/N').toString(),
        data_venda: v.data_emissao || v.data_competencia || v.data_venda || null,
        valor_total: v.valor_total || v.valor_servico || v.valor_composicao?.valor_liquido || 0,
        status: (v.status || v.situacao?.nome || v.situacao || '').toString().toUpperCase().includes('CANCEL') ? 'cancelado' : 'enviado',
        erro_mensagem: 'Sincronizado do Conta Azul',
        conta_azul_id: v.id || v.numero?.toString() || null,
        updated_at: v.data_emissao || new Date().toISOString()
      }))
    }

    return NextResponse.json({ notas: vendasFormatadas })

  } catch (err: any) {
    console.error('[notas-emitidas] Erro fatal:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor' }, 
      { status: err.statusCode || 500 }
    )
  }
}

// ─── POST: Cancelar uma nota emitida ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { empresa_id, nota_id, acao } = body

    if (!empresa_id || !nota_id || !acao) {
      return NextResponse.json({ error: 'empresa_id, nota_id e acao são obrigatórios' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    if (acao === 'cancelar') {
      // Verifica se a nota existe e pertence à empresa
      const { data: nota, error: notaErr } = await supabase
        .from('vendas_importadas')
        .select('id, status, os_numero')
        .eq('id', nota_id)
        .eq('empresa_id', empresa_id)
        .single()

      if (notaErr || !nota) {
        return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })
      }

      if (nota.status === 'cancelado') {
        return NextResponse.json({ error: 'Nota já está cancelada' }, { status: 400 })
      }

      // Atualiza o status para cancelado
      const { error: updateErr } = await supabase
        .from('vendas_importadas')
        .update({
          status: 'cancelado',
          erro_mensagem: `NFS-e Cancelada em ${new Date().toLocaleDateString('pt-BR')} — Cancelamento interno (simulado)`
        })
        .eq('id', nota_id)

      if (updateErr) {
        return NextResponse.json({ error: 'Erro ao cancelar: ' + updateErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        mensagem: `NFS-e da OS #${nota.os_numero} cancelada com sucesso.`
      })
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })

  } catch (err: any) {
    console.error('[notas-emitidas] Erro ao executar ação:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
