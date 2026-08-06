import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Salva/atualiza a Memória Fiscal dos produtos de uma venda.
 * Recebe um array de itens com seus dados fiscais e persiste no banco.
 * Usa UPSERT: se o produto (empresa_id + codigo) já existe, atualiza. Se não, cria.
 */
export async function POST(req: NextRequest) {
  try {
    const { empresa_id, itens } = await req.json()

    if (!empresa_id || !itens || !Array.isArray(itens)) {
      return NextResponse.json({ error: 'empresa_id e itens são obrigatórios' }, { status: 400 })
    }

    let salvos = 0
    let erros = 0

    for (const item of itens) {
      const codigo = String(item.codigo || '').trim()
      const descricao = String(item.descricao || '').trim()
      
      // Só salva se tem pelo menos um dado fiscal preenchido
      const temDadoFiscal = item.ncm || item.cest || item.tipo_produto || item.origem || item.unidade_medida
      if (!temDadoFiscal) continue

      if (item.salvarParaFamilia && descricao) {
        // Extrai a primeira palavra (palavra-chave/família)
        const palavraChave = descricao.split(' ')[0].toUpperCase()
        if (palavraChave) {
          const { error } = await supabaseAdmin
            .from('memoria_fiscal_familia')
            .upsert({
              empresa_id,
              palavra_chave: palavraChave,
              ncm: item.ncm || null,
              cest: item.cest || null,
              tipo_produto: item.tipo_produto || null,
              origem: item.origem || null,
              unidade_medida: item.unidade_medida || null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'empresa_id,palavra_chave'
            })

          if (error) {
            console.error(`[memoria-fiscal] Erro ao salvar família ${palavraChave}:`, error)
            erros++
          } else {
            salvos++
          }
        }
      } else if (codigo) {
        // Salva apenas pelo código exato
        const { error } = await supabaseAdmin
          .from('memoria_fiscal')
          .upsert({
            empresa_id,
            codigo,
            descricao: item.descricao || null,
            ncm: item.ncm || null,
            cest: item.cest || null,
            tipo_produto: item.tipo_produto || null,
            origem: item.origem || null,
            unidade_medida: item.unidade_medida || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'empresa_id,codigo'
          })

        if (error) {
          console.error(`[memoria-fiscal] Erro ao salvar ${codigo}:`, error)
          erros++
        } else {
          salvos++
        }
      }
    }

    return NextResponse.json({ salvos, erros })
  } catch (err: unknown) {
    console.error('[memoria-fiscal] Erro:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * Busca a Memória Fiscal para uma lista de produtos.
 * Retorna dois mapas:
 * - exata: mapa de código -> dados fiscais
 * - familia: mapa de palavra-chave -> dados fiscais
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresa_id = searchParams.get('empresa_id')
    const codigos = searchParams.get('codigos') // Códigos separados por vírgula

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
    }

    const mapaExata: Record<string, any> = {}
    const mapaFamilia: Record<string, any> = {}

    // Busca itens com código exato (se fornecidos)
    if (codigos) {
      const listaCodigos = codigos.split(',').map(c => c.trim()).filter(Boolean)
      if (listaCodigos.length > 0) {
        const { data: dataExata, error: errExata } = await supabaseAdmin
          .from('memoria_fiscal')
          .select('*')
          .eq('empresa_id', empresa_id)
          .in('codigo', listaCodigos)

        if (!errExata && dataExata) {
          for (const item of dataExata) {
            mapaExata[item.codigo] = item
          }
        }
      }
    }

    // Busca todas as famílias da empresa (a tabela tende a ser pequena)
    // Para um sistema gigante precisaríamos otimizar passando as palavras-chave na query
    const { data: dataFamilia, error: errFamilia } = await supabaseAdmin
      .from('memoria_fiscal_familia')
      .select('*')
      .eq('empresa_id', empresa_id)

    if (!errFamilia && dataFamilia) {
      for (const item of dataFamilia) {
        mapaFamilia[item.palavra_chave] = item
      }
    }

    return NextResponse.json({ memoria: mapaExata, memoria_familia: mapaFamilia })
  } catch (err: unknown) {
    console.error('[memoria-fiscal] Erro:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
