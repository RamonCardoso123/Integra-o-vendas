import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Importa uma planilha Excel do fiscal contendo Descrição, NCM e CEST.
 * Extrai a primeira palavra da descrição como "palavra-chave" (família do produto)
 * e salva na tabela memoria_fiscal_familia.
 * 
 * Também salva cada produto individual na tabela memoria_fiscal (pelo código, se presente).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const empresa_id = formData.get('empresa_id') as string | null

    if (!file || !empresa_id) {
      return NextResponse.json(
        { error: 'Arquivo e empresa_id são obrigatórios' },
        { status: 400 }
      )
    }

    // Ler o arquivo Excel
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Planilha vazia ou sem dados válidos' },
        { status: 400 }
      )
    }

    // Detectar nomes das colunas (pode ser DESCRIÇÃO, Descrição, descrição, DESCRIÇAO, etc.)
    const primeiraLinha = rows[0]
    const colunas = Object.keys(primeiraLinha)
    
    const findCol = (termos: string[]) => {
      return colunas.find(col => {
        const norm = col.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        return termos.some(t => norm.includes(t))
      })
    }

    const colDescricao = findCol(['DESCRICAO', 'DESCRIÇÃO', 'DESC', 'PRODUTO', 'NOME'])
    const colNCM = findCol(['NCM'])
    const colCEST = findCol(['CEST'])
    const colCodigo = findCol(['CODIGO', 'COD', 'CÓDIGO', 'COD.'])

    if (!colDescricao && !colNCM) {
      return NextResponse.json(
        { error: 'Não encontrei as colunas DESCRIÇÃO e NCM na planilha. Verifique o cabeçalho.' },
        { status: 400 }
      )
    }

    let salvos = 0
    let erros = 0
    let ignorados = 0

    // Mapa para evitar duplicatas de família — guarda a primeira ocorrência
    const familiasProcessadas = new Map<string, { ncm: string; cest: string }>()

    for (const row of rows) {
      const descricao = String(row[colDescricao!] || '').trim()
      const ncmRaw = String(row[colNCM!] || '').trim()
      const cestRaw = colCEST ? String(row[colCEST] || '').trim() : ''
      const codigoRaw = colCodigo ? String(row[colCodigo] || '').trim() : ''

      // Limpar NCM (remover pontos e espaços)
      const ncm = ncmRaw.replace(/[.\s]/g, '')
      // Limpar CEST (remover pontos e espaços)
      const cest = cestRaw.replace(/[.\s]/g, '')

      if (!descricao || !ncm) {
        ignorados++
        continue
      }

      // Extrair a primeira palavra como fallback
      const primeiraPalavra = descricao.split(/[\s/,;()-]+/)[0]?.toUpperCase()
      const descricaoCompleta = descricao.toUpperCase().replace(/\s+/g, ' ').trim()

      if (!primeiraPalavra || primeiraPalavra.length < 2) {
        ignorados++
        continue
      }

      // Guardar a descrição completa
      if (!familiasProcessadas.has(descricaoCompleta) || (cest && !familiasProcessadas.get(descricaoCompleta)?.cest)) {
        familiasProcessadas.set(descricaoCompleta, { ncm, cest })
      }

      // Guardar a primeira palavra como fallback (se já não houver, ou se esta tiver CEST e a anterior não)
      if (!familiasProcessadas.has(primeiraPalavra) || (cest && !familiasProcessadas.get(primeiraPalavra)?.cest)) {
        familiasProcessadas.set(primeiraPalavra, { ncm, cest })
      }

      // Se tiver código, salva também na memoria_fiscal (por código exato)
      if (codigoRaw) {
        try {
          const { error } = await supabaseAdmin
            .from('memoria_fiscal')
            .upsert({
              empresa_id,
              codigo: codigoRaw,
              descricao,
              ncm: ncm || null,
              cest: cest || null,
              origem: '0 - Nacional',
              tipo_produto: '00 - Merc. para Revenda',
              unidade_medida: 'UN',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'empresa_id,codigo'
            })
          if (error) {
            console.warn(`[importar-planilha] Erro ao salvar código ${codigoRaw}:`, error)
          }
        } catch (e) {
          console.warn(`[importar-planilha] Erro ao salvar código ${codigoRaw}:`, e)
        }
      }
    }

    // Agora salva todas as famílias
    for (const [palavraChave, dados] of familiasProcessadas.entries()) {
      try {
        const { error } = await supabaseAdmin
          .from('memoria_fiscal_familia')
          .upsert({
            empresa_id,
            palavra_chave: palavraChave,
            ncm: dados.ncm || null,
            cest: dados.cest || null,
            tipo_produto: '00 - Merc. para Revenda',
            origem: '0 - Nacional',
            unidade_medida: 'UN',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'empresa_id,palavra_chave'
          })

        if (error) {
          console.error(`[importar-planilha] Erro ao salvar família ${palavraChave}:`, error)
          erros++
        } else {
          salvos++
        }
      } catch (e) {
        console.error(`[importar-planilha] Erro ao salvar família ${palavraChave}:`, e)
        erros++
      }
    }

    return NextResponse.json({
      salvos,
      erros,
      ignorados,
      totalLinhas: rows.length,
      familiasEncontradas: familiasProcessadas.size,
      exemplos: Array.from(familiasProcessadas.entries()).slice(0, 10).map(
        ([chave, dados]) => `${chave} → NCM: ${dados.ncm}${dados.cest ? `, CEST: ${dados.cest}` : ''}`
      )
    })
  } catch (err: unknown) {
    console.error('[importar-planilha] Erro:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno ao processar planilha'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
