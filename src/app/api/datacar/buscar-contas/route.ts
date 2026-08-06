import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarContasPagar } from '@/services/datacar/client'
import { buscarCnpj } from '@/services/brasil-api/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Busca contas a pagar do Datacar e retorna no formato que o app já utiliza
 * para a revisão/envio ao Conta Azul.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      empresa_id,
      dtIni,
      dtFim,
      tipoPeriodo = 'venc',
      statusPagamento = 'todas', // 'apagar' | 'pagas' | 'todas'
      localPagamento = 'todos',  // 'todos' | 'BANCO' | 'CARTEIRA' | 'TRANSFERENCIA'
    } = await req.json()

    if (!empresa_id || !dtIni || !dtFim) {
      return NextResponse.json({ error: 'empresa_id, dtIni e dtFim são obrigatórios' }, { status: 400 })
    }

    // Buscar credenciais do Datacar
    const { data: empresa, error: empErr } = await supabaseAdmin
      .from('empresas')
      .select('datacar_token, datacar_cod_emp, datacar_id_operador, nome')
      .eq('id', empresa_id)
      .single()

    if (empErr || !empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    if (!empresa.datacar_token || !empresa.datacar_cod_emp || !empresa.datacar_id_operador) {
      return NextResponse.json({ error: 'Credenciais do Datacar não configuradas' }, { status: 400 })
    }

    const credentials = {
      token: empresa.datacar_token,
      codEmp: empresa.datacar_cod_emp,
      idOperador: empresa.datacar_id_operador,
    }

    // Buscar todas as páginas (Datacar retorna max 50 por página)
    let contasDatacar: Awaited<ReturnType<typeof buscarContasPagar>> = []
    let pagina = 1
    let continuar = true

    while (continuar) {
      const resultado = await buscarContasPagar(credentials, tipoPeriodo, dtIni, dtFim, String(pagina))
      if (resultado && resultado.length > 0) {
        contasDatacar = [...contasDatacar, ...resultado]
        pagina++
        // Se retornou menos de 50, é a última página
        if (resultado.length < 50) continuar = false
      } else {
        continuar = false
      }
    }

    // --- INTELIGÊNCIA DE FORNECEDORES (BRASIL API) ---
    const cnpjsUnicos = new Set<string>()

    contasDatacar.forEach(c => {
      if (c.cnpjEmit) cnpjsUnicos.add(c.cnpjEmit.replace(/\D/g, ''))
    })

    const dadosCnpjMap = new Map<string, any>()

    // Buscar CNPJs únicos em lotes de 10
    const cnpjsArray = Array.from(cnpjsUnicos).filter(c => c.length === 14) // Só buscar CNPJ (14 dígitos)
    for (let i = 0; i < cnpjsArray.length; i += 10) {
      const chunk = cnpjsArray.slice(i, i + 10)
      await Promise.all(chunk.map(async (cnpj) => {
        const dados = await buscarCnpj(cnpj)
        if (dados) dadosCnpjMap.set(cnpj, dados)
      }))
    }
    // --- FIM DA INTELIGÊNCIA DE FORNECEDORES ---

    // Converter para o formato do app (ContaPagarPreview)
    const dados = await Promise.all(contasDatacar.map(async (c) => {
      const valor = c.vlParc ?? 0
      
      let fornecedor = c.nomeEmit?.trim() || 'Fornecedor não informado'
      const cnpjLimpo = c.cnpjEmit ? c.cnpjEmit.replace(/\D/g, '') : ''
      
      // Enriquecer nome do fornecedor se achou na Brasil API (sem sobrescrever o original para não quebrar o De-Para)
      let razaoSocialBrasilAPI = null
      const dadosCnpjEncontrados = cnpjLimpo.length === 14 ? dadosCnpjMap.get(cnpjLimpo) : null
      if (dadosCnpjEncontrados?.razao_social) {
        razaoSocialBrasilAPI = dadosCnpjEncontrados.razao_social
      }
      const vencimento = c.dtVenc || ''
      const emissao = c.dtEmis || ''
      // Descrição = junção das colunas NF e DOC do Datacar (igual ao relatório CpRl010)
      const partes = [c.numNF, c.doc].filter(Boolean)
      const descricao = partes.length > 0 ? partes.join(' - ') : (c.obs || null)
      const doc = c.doc || null

      return {
        fornecedor,
        valor,
        vencimento,
        emissao: emissao || null,
        doc: doc,
        categoria: c.grupoDesp || null,
        descricao: descricao,
        valido: !!fornecedor && valor > 0 && !!vencimento,
        erros: [
          !fornecedor ? 'Fornecedor não informado' : null,
          valor <= 0 ? 'Valor inválido' : null,
          !vencimento ? 'Vencimento não informado' : null,
        ].filter(Boolean) as string[],
        // Campos extras do Datacar para referência
        _datacar: {
          siglaEmp: c.siglaEmp,
          parcela: c.parcela,
          cnpjEmit: c.cnpjEmit,
          grupoDesp: c.grupoDesp,
          subgrupoDesp: c.subgrupoDesp,
          bancoPgto: c.bancoPgto,
          dtPgto: c.dtPgto,
          localPgto: c.localPgto,
          razaoSocialBrasilAPI,
        }
      }
    }))

    // Aplicar filtro de Status de Pagamento
    let dadosFiltrados = dados
    if (statusPagamento === 'apagar') {
      // Somente contas A PAGAR: sem data de pagamento no Datacar
      dadosFiltrados = dadosFiltrados.filter(d => !d._datacar?.dtPgto)
    } else if (statusPagamento === 'pagas') {
      // Somente contas PAGAS: com data de pagamento no Datacar
      dadosFiltrados = dadosFiltrados.filter(d => !!d._datacar?.dtPgto)
    }
    // 'todas' = sem filtro

    // Aplicar filtro de Local de Pagamento
    if (localPagamento && localPagamento !== 'todos') {
      const localUpper = localPagamento.toUpperCase()
      dadosFiltrados = dadosFiltrados.filter(d => {
        const local = (d._datacar?.localPgto || '').toUpperCase()
        return local.includes(localUpper)
      })
    }

    const validos = dadosFiltrados.filter(d => d.valido).length
    const invalidos = dadosFiltrados.filter(d => !d.valido).length

    return NextResponse.json({
      total: dadosFiltrados.length,
      validos,
      invalidos,
      dados: dadosFiltrados,
      empresa_nome: empresa.nome,
    })

  } catch (err: unknown) {
    console.error('Erro ao buscar contas a pagar do Datacar:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
