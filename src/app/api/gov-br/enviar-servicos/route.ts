import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildDPSXml, type DadosDPS } from '@/lib/nfse/xml-builder'
import { extrairCertificadoPfx, assinarXmlNfse } from '@/lib/nfse/xml-signer'
import { decryptPasswordCompact } from '@/lib/crypto/cert-crypto'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const empresa_id = body.empresa_id
    const itens = body.itens || body.vendas // Aceita os dois formatos
    
    if (!empresa_id || !itens || itens.length === 0) {
      return NextResponse.json({ error: 'empresa_id e itens são obrigatórios' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. Busca a configuração fiscal e as credenciais
    const { data: configFiscal, error: configError } = await supabase
      .from('empresa_config_fiscal')
      .select('*')
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (configError || !configFiscal) {
      return NextResponse.json({ error: 'Configuração fiscal da empresa não encontrada.' }, { status: 404 })
    }

    if (!configFiscal.certificado_storage_path || !configFiscal.certificado_senha_encriptada) {
      return NextResponse.json({ error: 'Certificado digital não foi configurado para esta empresa.' }, { status: 400 })
    }

    // 2. Faz o download do arquivo PFX do cofre (Storage)
    const { data: fileData, error: fileError } = await supabase.storage
      .from('certificados_fiscais')
      .download(configFiscal.certificado_storage_path)

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'Erro ao baixar o certificado do cofre de segurança.' }, { status: 500 })
    }

    // 3. Descriptografa a senha usando a Master Key
    let senhaCertificado: string
    try {
      senhaCertificado = decryptPasswordCompact(configFiscal.certificado_senha_encriptada)
    } catch (err) {
      console.error('[gov-br] Falha ao descriptografar senha:', err)
      return NextResponse.json({ error: 'Falha na segurança: A Master Key do servidor é inválida ou incompatível.' }, { status: 500 })
    }

    // 4. Converte o certificado (extrai chave privada e PEM)
    const pfxBuffer = Buffer.from(await fileData.arrayBuffer())
    const certData = await extrairCertificadoPfx(pfxBuffer, senhaCertificado)

    // Resultados de processamento
    const resultados = []

    // 5. Processa cada venda importada
    for (const item of itens) {
      try {
        // Formata os dados para o XML
        // Tenta usar os dados fiscais da venda (editados no modal) ou fallback para os do config
        const f = item._fiscal || {}
        
        const dadosDps: DadosDPS = {
          numeroOS: item.os_numero || Date.now().toString(),
          dataCompetencia: new Date().toISOString(), // Emissão sempre será data atual
          valorServico: item.valor_total,
          descricao: item.itens.map((i: any) => `${i.quantidade}x ${i.descricao}`).join(' | '),
          cliente: {
            documento: f.clienteCpfCnpj || item.cliente_cpf_cnpj || '00000000000', 
            nome: f.clienteNome || item.cliente || 'Cliente Padrão',
            cidade: configFiscal.cidade_ibge || '3106200', // idealmente buscar o codigo ibge da cidade, deixaremos fallback
            cep: f.clienteCep || item.cliente_endereco_cep,
            logradouro: f.clienteLogradouro || item.cliente_endereco_logradouro,
            numero: f.clienteNumero || item.cliente_endereco_numero,
            bairro: f.clienteBairro || item.cliente_endereco_bairro,
          },
          emitente: {
            cnpj: configFiscal.cnpj || '',
            inscricaoMunicipal: configFiscal.inscricao_municipal || '',
            regimeTributario: f.regime === 'simples' ? 1 : configFiscal.regime_tributario || 1 // O modal manda 'simples', etc.
          },
          codigoTributarioNacional: f.codigoTributarioNacional || '14.01.01',
          codigoComplementarMunicipal: f.codigoComplementar || '14.01.01.001',
          itemNBS: f.nbs || '120013110',
          aliquotaSimplesNacional: f.aliquotaSimples ? parseFloat(f.aliquotaSimples) : (configFiscal.aliquota_simples_nacional || 11.34),
          aliquotaIssqn: f.aliquotaIssqn ? parseFloat(f.aliquotaIssqn) : (configFiscal.aliquota_issqn || undefined),
        }

        // 6. Constrói o XML da DPS
        const xmlBase = buildDPSXml(dadosDps)
        const referenceId = `DPS${dadosDps.numeroOS}`

        // 7. Assina digitalmente o XML usando o certificado
        const xmlAssinado = assinarXmlNfse(xmlBase, certData, referenceId)

        // 8. SIMULAÇÃO DO ENVIO (MOCK) - Aqui entraria o fetch para a Receita
        console.log(`[gov-br] Simulando envio da DPS ${referenceId} para a Receita (Homologação). Tamanho XML: ${xmlAssinado.length} bytes.`)
        await new Promise(r => setTimeout(r, 800)) // Simula tempo de rede

        // Atualiza a venda na tabela (mudando o status)
        await supabase
          .from('vendas_importadas')
          .update({ status: 'enviado', erro_mensagem: 'NFS-e Emitida via Gov.br' })
          .eq('id', item.id)

        resultados.push({
          id: item.id,
          sucesso: true,
          os_numero: item.os_numero,
          mensagem: 'NFS-e autorizada com sucesso (Simulação Homologação)'
        })

      } catch (itemErr: any) {
        console.error(`[gov-br] Falha ao processar a venda ${item.id}:`, itemErr)
        resultados.push({
          id: item.id,
          sucesso: false,
          os_numero: item.os_numero,
          erro: itemErr.message || 'Erro desconhecido ao gerar/assinar o XML'
        })
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length
    const errosCount = resultados.filter(r => !r.sucesso).length
    const detalhesErros = resultados.filter(r => !r.sucesso).map(r => `OS ${r.os_numero}: ${r.erro}`)

    return NextResponse.json({
      success: true,
      mensagem: 'Lote de NFS-e processado.',
      sucessos,
      erros: errosCount,
      detalhesErros,
      resultados
    })

  } catch (err: unknown) {
    console.error('[gov-br] Falha fatal no endpoint:', err)
    return NextResponse.json({ error: 'Erro interno no servidor ao tentar emitir notas' }, { status: 500 })
  }
}
