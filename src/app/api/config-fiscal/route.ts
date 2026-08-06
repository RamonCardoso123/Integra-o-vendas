/**
 * API Route: /api/config-fiscal
 * Gerencia configurações fiscais da empresa (certificado A1, CNPJ, etc.)
 * 
 * GET  → Retorna a configuração fiscal da empresa (sem a senha descriptografada)
 * POST → Salva/atualiza a configuração fiscal e faz upload do certificado
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptPasswordCompact } from '@/lib/crypto/cert-crypto'

// Supabase admin (service role) para acessar buckets privados
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get('empresa_id')
    if (!empresaId) {
      return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('empresa_config_fiscal')
      .select('id, empresa_id, cnpj, inscricao_municipal, regime_tributario, aliquota_simples_nacional, aliquota_issqn, certificado_nome_arquivo, certificado_validade, created_at, updated_at')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (error) {
      console.error('[config-fiscal] Erro ao buscar config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      config: data || null,
      temCertificado: !!data?.certificado_nome_arquivo,
    })
  } catch (err: unknown) {
    console.error('[config-fiscal] Erro inesperado GET:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const empresaId = formData.get('empresa_id') as string
    const cnpj = formData.get('cnpj') as string | null
    const inscricaoMunicipal = formData.get('inscricao_municipal') as string | null
    const regimeTributario = formData.get('regime_tributario') as string | null
    const aliquotaSimplesNacional = formData.get('aliquota_simples_nacional') as string | null
    const aliquotaIssqn = formData.get('aliquota_issqn') as string | null
    const senhaCertificado = formData.get('senha_certificado') as string | null
    const certificadoFile = formData.get('certificado') as File | null

    if (!empresaId) {
      return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Prepara o payload de upsert
    const payload: Record<string, unknown> = {
      empresa_id: empresaId,
      updated_at: new Date().toISOString(),
    }

    if (cnpj) payload.cnpj = cnpj.replace(/\D/g, '')
    if (inscricaoMunicipal) payload.inscricao_municipal = inscricaoMunicipal
    if (regimeTributario) payload.regime_tributario = parseInt(regimeTributario) || 1
    if (aliquotaSimplesNacional) payload.aliquota_simples_nacional = parseFloat(aliquotaSimplesNacional)
    if (aliquotaIssqn) payload.aliquota_issqn = parseFloat(aliquotaIssqn)

    // Upload do certificado (se enviado)
    if (certificadoFile && certificadoFile.size > 0) {
      const nomeArquivo = certificadoFile.name
      const storagePath = `${empresaId}/${Date.now()}_${nomeArquivo}`

      // Faz upload para o bucket privado
      const buffer = Buffer.from(await certificadoFile.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from('certificados_fiscais')
        .upload(storagePath, buffer, {
          contentType: certificadoFile.type || 'application/x-pkcs12',
          upsert: true,
        })

      if (uploadError) {
        console.error('[config-fiscal] Erro upload certificado:', uploadError)
        return NextResponse.json({ error: `Erro ao fazer upload do certificado: ${uploadError.message}` }, { status: 500 })
      }

      payload.certificado_nome_arquivo = nomeArquivo
      payload.certificado_storage_path = storagePath

      console.log(`[config-fiscal] Certificado '${nomeArquivo}' salvo em bucket privado: ${storagePath}`)
    }

    // Criptografa a senha (se enviada)
    if (senhaCertificado) {
      const senhaCriptografada = encryptPasswordCompact(senhaCertificado)
      // Formato compacto: encrypted:iv:authTag
      const [encrypted, iv] = senhaCriptografada.split(':')
      payload.certificado_senha_encriptada = senhaCriptografada
      payload.certificado_iv = iv
      console.log(`[config-fiscal] Senha criptografada com AES-256-GCM (${encrypted.length} chars)`)
    }

    // Upsert: insere ou atualiza se já existir
    const { data: existing } = await supabase
      .from('empresa_config_fiscal')
      .select('id')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    let result
    if (existing) {
      result = await supabase
        .from('empresa_config_fiscal')
        .update(payload)
        .eq('empresa_id', empresaId)
        .select()
        .single()
    } else {
      result = await supabase
        .from('empresa_config_fiscal')
        .insert(payload)
        .select()
        .single()
    }

    if (result.error) {
      console.error('[config-fiscal] Erro ao salvar config fiscal:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração fiscal salva com sucesso!',
      config: {
        id: result.data.id,
        empresa_id: result.data.empresa_id,
        cnpj: result.data.cnpj,
        inscricao_municipal: result.data.inscricao_municipal,
        regime_tributario: result.data.regime_tributario,
        aliquota_simples_nacional: result.data.aliquota_simples_nacional,
        aliquota_issqn: result.data.aliquota_issqn,
        certificado_nome_arquivo: result.data.certificado_nome_arquivo,
        certificado_validade: result.data.certificado_validade,
      }
    })
  } catch (err: unknown) {
    console.error('[config-fiscal] Erro inesperado POST:', err)
    return NextResponse.json({ error: 'Erro interno ao salvar configuração fiscal' }, { status: 500 })
  }
}
