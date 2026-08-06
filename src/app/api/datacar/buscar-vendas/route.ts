import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarOSPedidos, buscarProdutos, DatacarProdutoResponse } from '@/services/datacar/client'
import { buscarCnpj, buscarCep, enriquecerEndereco, EnderecoDatacar } from '@/services/brasil-api/client'
import { buscarVendasContaAzul, verificarNfeEmitidaDaVenda } from '@/lib/conta-azul/api'
import { getValidToken } from '@/lib/conta-azul/token-manager'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Busca OS/Pedidos (vendas) do Datacar e retorna no formato do app.
 * Busca todas as páginas automaticamente.
 */
export async function POST(req: NextRequest) {
  try {
    let { empresa_id, dtIni, dtFim, tipoPeriodo = 'encerramento', situacao = 'todas', numeroOS } = await req.json()

    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
    }

    if (!numeroOS && (!dtIni || !dtFim)) {
      return NextResponse.json({ error: 'dtIni e dtFim são obrigatórios se número da OS não for informado' }, { status: 400 })
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

    // Se um número de OS específico foi informado, ignora os filtros do usuário
    // e busca em um período amplo (desde 2022 até hoje)
    if (numeroOS) {
      tipoPeriodo = 'criacao'
      dtIni = '2022-01-01'
      
      const hoje = new Date()
      const dia = String(hoje.getDate()).padStart(2, '0')
      const mes = String(hoje.getMonth() + 1).padStart(2, '0')
      const ano = hoje.getFullYear()
      dtFim = `${ano}-${mes}-${dia}`
    }

    // Buscar todas as páginas (Datacar retorna max 50 por página)
    let allOS: Awaited<ReturnType<typeof buscarOSPedidos>> = []
    let pagina = 1
    let continuar = true

    while (continuar) {
      const resultado = await buscarOSPedidos(credentials, tipoPeriodo, dtIni, dtFim, String(pagina))
      if (resultado && resultado.length > 0) {
        
        // Se estamos buscando uma OS específica, paramos logo que encontrá-la
        if (numeroOS) {
          const found = resultado.find(os => String(os.venda_Numero) === String(numeroOS))
          if (found) {
            allOS = [found]
            break
          }
        }

        allOS = [...allOS, ...resultado]
        pagina++
        // Se retornou menos de 50, é a última página
        if (resultado.length < 50) continuar = false
      } else {
        continuar = false
      }
    }

    // Garante que só retorne a OS buscada, caso tenha percorrido tudo e achado no meio
    if (numeroOS) {
      allOS = allOS.filter(os => String(os.venda_Numero) === String(numeroOS))
    }

    // === LOG DE DIAGNÓSTICO REMOVIDO PARA MELHORAR PERFORMANCE ===
    // (Logs de objetos gigantes pesavam na execução e na memória)
    const codigosProdutos = new Set<string>()
    const descricoesProdutos = new Map<string, string>() // Para a busca na Brasil API
    allOS.forEach(os => {
      os.produtos?.forEach(p => {
        // CORREÇÃO: Priorizando o código interno (produto_Codigo) sobre o código do fabricante (produto_CodigoFabric)
        const cod = String(p.produto_Codigo || p.produto_CodigoFabric || p.codigo || '').trim()
        if (cod) {
          codigosProdutos.add(cod)
          descricoesProdutos.set(cod, String(p.produto_Descricao || p.descricao || ''))
        }
      })
    })

    // Buscar metadados dos produtos no Datacar (NCM, Origem)
    const produtosMetadata = new Map<string, DatacarProdutoResponse>()
    const codigosArray = Array.from(codigosProdutos)
    
    // Lotes de 20 para evitar timeouts e sobrecarga (antes era 10)
    for (let i = 0; i < codigosArray.length; i += 20) {
      const chunk = codigosArray.slice(i, i + 20)
      const promessas = chunk.map(async (codigo) => {
        try {
          const res = await buscarProdutos(credentials, codigo)
          if (res && res.length > 0) {
            // Find exact match just in case
            const match = res.find(p => p.codigo?.trim() === codigo)
            if (match) produtosMetadata.set(codigo, match)
          }
        } catch (e) {
          console.warn(`Erro ao buscar metadados do produto ${codigo} no Datacar:`, e)
        }
      })
      await Promise.all(promessas)
    }

    // --- NOVA LÓGICA DE INTELIGÊNCIA FISCAL ---
    // Buscar memória fiscal para todos os produtos encontrados nestas OS
    // Usando consulta direta ao Supabase em vez de fetch interno (evita timeout)
    let memoriaFiscalExata: Record<string, any> = {}
    let memoriaFiscalFamilia: Record<string, any> = {}
    if (codigosProdutos.size > 0) {
      try {
        // Busca exata por código
        const listaCodigos = Array.from(codigosProdutos)
        const { data: dataExata } = await supabaseAdmin
          .from('memoria_fiscal')
          .select('*')
          .eq('empresa_id', empresa_id)
          .in('codigo', listaCodigos)

        if (dataExata) {
          for (const item of dataExata) {
            memoriaFiscalExata[item.codigo] = item
          }
        }

        // Busca por família (todas as famílias da empresa)
        const { data: dataFamilia } = await supabaseAdmin
          .from('memoria_fiscal_familia')
          .select('*')
          .eq('empresa_id', empresa_id)

        if (dataFamilia) {
          for (const item of dataFamilia) {
            memoriaFiscalFamilia[item.palavra_chave] = item
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar memória fiscal:', e)
      }
    }

    // Preparar um mapa de NCM para CEST usando a memória fiscal inteira da empresa (para dedução)
    const ncmParaCest = new Map<string, string>()
    try {
      const { data: todosMemoria } = await supabaseAdmin.from('memoria_fiscal').select('ncm, cest').eq('empresa_id', empresa_id).not('cest', 'is', null)
      if (todosMemoria) {
        todosMemoria.forEach(m => {
          if (m.ncm && m.cest) ncmParaCest.set(m.ncm, m.cest)
        })
      }
    } catch (e) {}

    // Pré-calcular dados fiscais de cada produto
    const inteligenciaFiscal = new Map<string, any>()
    for (const codigo of Array.from(codigosProdutos)) {
      let ncm = null
      let cest = null
      let tipo = null
      let origem = null
      let unidade = 'UN'
      const descricao = descricoesProdutos.get(codigo) || ''
      const descNormalizada = descricao.toUpperCase().replace(/\s+/g, ' ').trim()
      const palavras = descNormalizada.split(' ')
      
      // Encontrar melhor match de família (do mais longo para o mais curto)
      let matchFamilia = null
      for (let i = palavras.length; i > 0; i--) {
        const prefixo = palavras.slice(0, i).join(' ')
        if (memoriaFiscalFamilia[prefixo]) {
          matchFamilia = memoriaFiscalFamilia[prefixo]
          break
        }
      }

      // Prioridade 1: Nossa Memória Fiscal Exata (por código)
      if (memoriaFiscalExata[codigo]) {
        const mem = memoriaFiscalExata[codigo]
        ncm = mem.ncm
        cest = mem.cest
        tipo = mem.tipo_produto
        origem = mem.origem
        unidade = mem.unidade_medida || 'UN'
      } 
      // Prioridade 2: Nossa Memória Fiscal por Família (match do maior prefixo)
      else if (matchFamilia) {
        ncm = matchFamilia.ncm
        cest = matchFamilia.cest
        tipo = matchFamilia.tipo_produto
        origem = matchFamilia.origem
        unidade = matchFamilia.unidade_medida || 'UN'
      }
      else {
        // Prioridade 3: Brasil API (apenas para NCM se não temos na memória)
        if (descricao) {
          try {
            const firstWord = descricao.split(' ')[0]
            const termoBusca = encodeURIComponent(firstWord)
            const brasilRes = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${termoBusca}`)
            if (brasilRes.ok) {
              const resultados = await brasilRes.json()
              if (resultados && Array.isArray(resultados) && resultados.length > 0) {
                const ncmValido = resultados.find((r: any) => r.codigo && r.codigo.replace(/\./g, '').length === 8)
                if (ncmValido) {
                  ncm = ncmValido.codigo.replace(/\./g, '')
                  
                  // Se achou NCM na Brasil API, verifica se temos um CEST conhecido para esse NCM
                  if (ncm && ncmParaCest.has(ncm)) {
                    cest = ncmParaCest.get(ncm)
                  }
                }
              }
            }
          } catch (e) {
             console.warn(`Erro na Brasil API para ${descricao}:`, e)
          }
        }
      }

      // Prioridade 4: Datacar (último caso)
      const metadados = produtosMetadata.get(codigo)
      if (!ncm) ncm = metadados?.ncm || undefined
      if (!cest) cest = metadados?.cest || undefined
      if (!origem) origem = metadados?.origem || '0 - Nacional'
      if (!tipo) tipo = '00 - Merc. para Revenda'
      if (!unidade) unidade = metadados?.unidade_medida || 'UN'

      inteligenciaFiscal.set(codigo, { ncm, cest, tipo, origem, unidade })
    }
    // --- FIM DA NOVA LÓGICA ---

    // --- INTELIGÊNCIA DE CLIENTES (BRASIL API) ---
    const cpfsCnpjsUnicos = new Set<string>()
    const cepsUnicos = new Set<string>()

    allOS.forEach(os => {
      if (os.cliente_Cpf_Cnpj) cpfsCnpjsUnicos.add(os.cliente_Cpf_Cnpj.replace(/\D/g, ''))
      const cep = os.end_Cep || os.cliente_Cep || os.cliente_CEP
      if (cep) cepsUnicos.add(cep.replace(/\D/g, ''))
    })

    const dadosCnpjMap = new Map<string, any>()
    const dadosCepMap = new Map<string, any>()

    // Buscar CNPJs únicos em lotes de 20 (Brasil API tem rate limit alto)
    const cnpjsArray = Array.from(cpfsCnpjsUnicos).filter(c => c.length === 14) // Só buscar CNPJ (14 dígitos)
    for (let i = 0; i < cnpjsArray.length; i += 20) {
      const chunk = cnpjsArray.slice(i, i + 20)
      await Promise.all(chunk.map(async (cnpj) => {
        const dados = await buscarCnpj(cnpj)
        if (dados) dadosCnpjMap.set(cnpj, dados)
      }))
    }

    // Buscar CEPs únicos em lotes de 20
    const cepsArray = Array.from(cepsUnicos).filter(c => c.length === 8) // Só buscar CEP válido (8 dígitos)
    for (let i = 0; i < cepsArray.length; i += 20) {
      const chunk = cepsArray.slice(i, i + 20)
      await Promise.all(chunk.map(async (cep) => {
        const dados = await buscarCep(cep)
        if (dados) dadosCepMap.set(cep, dados)
      }))
    }
    // --- FIM DA INTELIGÊNCIA DE CLIENTES ---

    // Converter para o formato VendaPreview do app (sem filtrar canceladas — o frontend filtra pela situação)
    const dados = await Promise.all(allOS.map(async (os) => {
      // Determinar situação da OS com base nas datas disponíveis
      let situacao: 'em_andamento' | 'concluida' | 'encerrada' | 'cancelada' = 'em_andamento'
      if (os.venda_DtCancelamento) situacao = 'cancelada'
      else if (os.venda_DtEncerramento) situacao = 'encerrada'
      else if (os.venda_DtConclusao) situacao = 'concluida'
      
      // IMPORTANTE: Sempre usa o nome que veio do Datacar como principal.
      // NÃO substitui pelo nome da Brasil API (razao_social) pois pode retornar nome incorreto.
      const cliente = os.cliente_Nome?.trim() || os.cliente_RazaoSocial?.trim() || 'Cliente não informado'
      const cliente_cpf_cnpj = os.cliente_Cpf_Cnpj || null
      
      // Obter dados enriquecidos se for CNPJ (apenas para endereço, NÃO para nome)
      const cnpjLimpo = cliente_cpf_cnpj ? cliente_cpf_cnpj.replace(/\D/g, '') : ''
      const dadosCnpjEncontrados = cnpjLimpo.length === 14 ? dadosCnpjMap.get(cnpjLimpo) : null

      const osNumero = String(os.venda_Numero || '')
      const dataVenda = os.venda_DtEncerramento || os.venda_DtConclusao || os.venda_DtCriacao || ''

      // Montar itens para o Conta Azul
      // Campos reais da API Datacar:
      //   Produtos: produto_Codigo, produto_CodigoFabric, produto_Descricao, venda_Qtde, venda_VlBruto, venda_VlDesc, venda_Custo
      //   Serviços: servico_Codigo, servico_Descricao, venda_Qtde, venda_VlBruto, venda_Custo
      // venda_VlBruto = valor unitário bruto (antes do desconto)
      // venda_VlDesc = valor do desconto unitário
      // Valor líquido unitário = venda_VlBruto - venda_VlDesc
      // Valor total do item = quantidade * valor líquido unitário
      const itens = [
        ...(os.produtos || []).map((p: Record<string, unknown>) => {
          const qtde = Number(p.venda_Qtde || p.quantidade || p.qtde || 1)
          const vlBruto = Number(p.venda_VlBruto || p.valorUnitario || p.vlUnitario || 0)
          const vlDesc = Number(p.venda_VlDesc || 0)
          const valorUnitarioLiquido = parseFloat(Math.max(0, vlBruto - vlDesc).toFixed(4))
          const totalItem = parseFloat((qtde * valorUnitarioLiquido).toFixed(2))
          const codigoItem = String(p.produto_Codigo || p.produto_CodigoFabric || p.codigo || '').trim()
          
          const infoFiscal = inteligenciaFiscal.get(codigoItem) || {}

          return {
            codigo: codigoItem,
            descricao: String(p.produto_Descricao || p.descricao || 'Produto'),
            quantidade: qtde,
            valor_unitario: valorUnitarioLiquido,
            valor_unitario_original: vlBruto,
            desconto: vlDesc,
            valor_total: totalItem,
            tipo: 'produto',
            ncm: infoFiscal.ncm || undefined,
            origem: infoFiscal.origem || undefined,
            cest: infoFiscal.cest || undefined,
            tipo_produto: infoFiscal.tipo || undefined,
            unidade_medida: infoFiscal.unidade || 'UN'
          }
        }),
        ...(os.servicos || []).map((s: Record<string, unknown>) => {
          const qtde = Number(s.venda_Qtde || s.quantidade || s.qtde || 1)
          const vlBruto = Number(s.venda_VlBruto || s.valorUnitario || s.vlUnitario || 0)
          const vlDesc = Number(s.venda_VlDesc || 0)
          const valorUnitarioLiquido = parseFloat(Math.max(0, vlBruto - vlDesc).toFixed(4))
          const totalItem = parseFloat((qtde * valorUnitarioLiquido).toFixed(2))
          return {
            codigo: String(s.servico_Codigo || s.codigo || ''),
            descricao: String(s.servico_Descricao || s.descricao || 'Serviço'),
            quantidade: qtde,
            valor_unitario: valorUnitarioLiquido,
            valor_unitario_original: vlBruto,
            desconto: vlDesc,
            valor_total: totalItem,
            tipo: 'servico',
          }
        }),
      ]

      // Valor total da venda = soma dos valores totais de cada item
      const totalProdutos = itens.filter(i => i.tipo === 'produto').reduce((sum, i) => sum + i.valor_total, 0)
      const totalServicos = itens.filter(i => i.tipo === 'servico').reduce((sum, i) => sum + i.valor_total, 0)
      const valorTotal = parseFloat((totalProdutos + totalServicos).toFixed(2))

      const enderecoBase: EnderecoDatacar = {
        logradouro: os.end_Rua || os.cliente_Logradouro || os.cliente_Endereco || null,
        numero: os.end_Numero || os.cliente_Numero || null,
        complemento: os.end_Complemento || os.cliente_Complemento || null,
        bairro: os.end_Bairro || os.cliente_Bairro || null,
        cidade: os.end_Cidade || os.cliente_Cidade || os.cliente_Municipio || null,
        estado: os.end_Uf || os.cliente_Uf || os.cliente_Estado || os.cliente_UF || null,
        cep: os.end_Cep || os.cliente_Cep || os.cliente_CEP || null,
      }

      // Enriquecer endereço se tiver CEP (lembrando que enriquecerEndereco lida com dadosCnpj tb)
      if (enderecoBase.cep && enderecoBase.cep.length >= 8) {
        const cepLimpo = enderecoBase.cep.replace(/\D/g, '')
        const dadosCep = dadosCepMap.get(cepLimpo)
        if (dadosCep) {
          // Atualiza dados base usando os dados de CEP da Brasil API (mantém numero/complemento)
          enderecoBase.logradouro = dadosCep.street || enderecoBase.logradouro
          enderecoBase.bairro = dadosCep.neighborhood || enderecoBase.bairro
          enderecoBase.cidade = dadosCep.city || enderecoBase.cidade
          enderecoBase.estado = dadosCep.state || enderecoBase.estado
        }
      }
      
      // Enriquecer endereço via CNPJ se tiver (tem precedência)
      if (dadosCnpjEncontrados) {
        enderecoBase.logradouro = dadosCnpjEncontrados.logradouro || enderecoBase.logradouro
        enderecoBase.numero = dadosCnpjEncontrados.numero || enderecoBase.numero
        enderecoBase.complemento = dadosCnpjEncontrados.complemento || enderecoBase.complemento
        enderecoBase.bairro = dadosCnpjEncontrados.bairro || enderecoBase.bairro
        enderecoBase.cidade = dadosCnpjEncontrados.municipio || enderecoBase.cidade
        enderecoBase.estado = dadosCnpjEncontrados.uf || enderecoBase.estado
        enderecoBase.cep = dadosCnpjEncontrados.cep || enderecoBase.cep
      }

      return {
        cliente,
        cliente_cpf_cnpj: os.cliente_Cpf_Cnpj || null,
        cliente_endereco: enderecoBase,
        os_numero: osNumero,
        data_venda: dataVenda,
        valor_total: valorTotal,
        forma_pagamento: os.venda_Parcelamento || undefined,
        situacao,
        itens,
        valido: !!cliente && valorTotal > 0,
        erros: [
          !cliente ? 'Cliente não informado' : null,
          valorTotal <= 0 ? `Valor total zerado (Produtos: ${totalProdutos}, Serviços: ${totalServicos})` : null,
        ].filter(Boolean) as string[],
        // Dados extras para referência
        _datacar: {
          venda_Id: os.venda_Id,
          empresa_sigla: os.empresa_sigla,
          vendedor: os.vendedor_Nome,
          veiculo: os.veiculo_Placa ? `${os.veiculo_Marca || ''} ${os.veiculo_Modelo || ''} - ${os.veiculo_Placa}`.trim() : null,
          cliente_cpf_cnpj: os.cliente_Cpf_Cnpj,
          // Endereço completo do cliente (Datacar usa prefixo end_ para OS/Pedidos)
          cliente_logradouro: os.end_Rua || os.cliente_Logradouro || os.cliente_Endereco || null,
          cliente_numero: os.end_Numero || os.cliente_Numero || null,
          cliente_complemento: os.end_Complemento || os.cliente_Complemento || null,
          cliente_bairro: os.end_Bairro || os.cliente_Bairro || null,
          cliente_cidade: os.end_Cidade || os.cliente_Cidade || os.cliente_Municipio || null,
          cliente_uf: os.end_Uf || os.cliente_Uf || os.cliente_Estado || os.cliente_UF || null,
          cliente_cep: os.end_Cep || os.cliente_Cep || os.cliente_CEP || null,
          raw: os // Salvando o raw completo para a revisão
        }
      }
    }))

    // Filtra pela situação solicitada antes de contar
    const dadosFiltrados = dados.filter(d => situacao === 'todas' || d.situacao === situacao)

    // --- DETECÇÃO DE DUPLICIDADE NO CONTA AZUL ---
    // Tenta buscar vendas no CA para o mesmo período. Se não conseguir (ex: CA não conectado),
    // simplesmente segue sem marcação de duplicidade — NÃO interfere no fluxo principal.
    try {
      const { accessToken: caToken } = await getValidToken(empresa_id)

      // Converter datas do formato DD/MM/YYYY para YYYY-MM-DD
      let dtIniISO = dtIni
      let dtFimISO = dtFim
      if (dtIni.includes('/')) {
        const [d, m, y] = dtIni.split('/')
        dtIniISO = `${y}-${m}-${d}`
      }
      if (dtFim.includes('/')) {
        const [d, m, y] = dtFim.split('/')
        dtFimISO = `${y}-${m}-${d}`
      }

      const vendasCA = await buscarVendasContaAzul(caToken, dtIniISO, dtFimISO)
      console.log(`[duplicidade] Encontradas ${vendasCA.length} vendas no CA para o período ${dtIniISO} a ${dtFimISO}`)

      if (vendasCA.length > 0) {
        // Montar mapa de chaves para cruzar: normaliza CPF/CNPJ + Data + Valor
        const vendasCAMap = new Map<string, { id: string; valor: number }[]>()
        for (const vc of vendasCA) {
          const docRaw = (vc as any).documento_cliente || vc.cliente?.documento || (vc.cliente as any)?.cpf_cnpj || ''
          const cpfCnpj = docRaw.replace(/\\D/g, '')
          const dataVenda = vc.data_venda?.split('T')[0] || ''
          const valor = Math.round(((vc as any).valor_composicao?.valor_liquido || vc.valor_total || 0) * 100) // centavos
          if (cpfCnpj && dataVenda) {
            const chave = `${cpfCnpj}_${dataVenda}_${valor}`
            if (!vendasCAMap.has(chave)) vendasCAMap.set(chave, [])
            vendasCAMap.get(chave)!.push({ id: vc.id, valor })
          }
        }

        // Para cada venda do Datacar, verificar se já existe no CA
        const vendasComNfe: string[] = [] // IDs de vendas CA para verificar NFe em lote
        for (const venda of dadosFiltrados) {
          const cpfCnpj = (venda as any).cliente_cpf_cnpj?.replace(/\\D/g, '') || ''
          let dataVendaISO = venda.data_venda?.split('T')[0]?.split(' ')[0] || ''
          if (dataVendaISO.includes('/')) {
            const [d, m, y] = dataVendaISO.split('/')
            dataVendaISO = `${y}-${m}-${d}`
          }
          const valor = Math.round((venda.valor_total || 0) * 100)

          if (cpfCnpj && dataVendaISO) {
            const chave = `${cpfCnpj}_${dataVendaISO}_${valor}`
            const match = vendasCAMap.get(chave)
            if (match && match.length > 0) {
              ;(venda as any).ca_status = 'enviado_sem_nota'
              ;(venda as any)._ca_venda_id = match[0].id
              vendasComNfe.push(match[0].id)
            }
          }
        }

        // Verificar NFe para vendas que deram match (em lotes de 10 para não sobrecarregar)
        for (let i = 0; i < vendasComNfe.length; i += 10) {
          const chunk = vendasComNfe.slice(i, i + 10)
          const resultados = await Promise.all(
            chunk.map(vendaId => verificarNfeEmitidaDaVenda(caToken, vendaId))
          )
          for (let j = 0; j < chunk.length; j++) {
            if (resultados[j].temNfe) {
              const vendaEncontrada = dadosFiltrados.find((v: any) => v._ca_venda_id === chunk[j])
              if (vendaEncontrada) {
                ;(vendaEncontrada as any).ca_status = 'enviado_com_nota'
                ;(vendaEncontrada as any).ca_nfe_numero = resultados[j].numeroNota || null
              }
            }
          }
        }
      }

      // --- DETECÇÃO DE CLIENTE COM VENDAS ANTERIORES NO CA ---
      // Apenas para os CPFs/CNPJs que não deram match exato nas vendas, vamos verificar se já possuem vendas
      const cpfsCnpjsParaVerificar = Array.from(new Set(
        dadosFiltrados
          .filter((d: any) => !d.ca_status) // Somente os que ainda não têm status de duplicidade exata
          .map((d: any) => d.cliente_cpf_cnpj?.replace(/\\D/g, ''))
          .filter(Boolean)
      )) as string[]

      if (cpfsCnpjsParaVerificar.length > 0) {
        const clientesExistentesCA = new Set<string>()
        const urlBaseCA = 'https://api-v2.contaazul.com/v1/venda/busca'
        
        // Fazer buscas em lotes de 10 para agilizar sem estourar rate limit
        for (let i = 0; i < cpfsCnpjsParaVerificar.length; i += 10) {
          const chunk = cpfsCnpjsParaVerificar.slice(i, i + 10)
          await Promise.all(chunk.map(async (doc) => {
            try {
              // Buscar vendas para esse documento. Se existir venda, o cliente já existe e tem histórico.
              const url = `${urlBaseCA}?termo_busca=${doc}&tamanho_pagina=1`
              console.log(`[duplicidade-cliente] Buscando vendas anteriores para CPF/CNPJ: ${doc} em ${url}`)
              const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${caToken}` }
              })
              console.log(`[duplicidade-cliente] Resposta para ${doc}: status=${res.status}`)
              if (res.ok) {
                const data = await res.json()
                const lista = data.itens || data.items || data.content || data.data || (Array.isArray(data) ? data : [])
                console.log(`[duplicidade-cliente] CPF/CNPJ ${doc}: ${lista.length} vendas encontradas`)
                if (lista.length > 0) {
                  // Se encontrou alguma venda, verifica se o documento bate
                  const matchDoc = lista.find((v: any) => {
                    const pDoc = (v.documento_cliente || v.cliente?.documento || '').replace(/\\D/g, '')
                    return pDoc === doc || pDoc.includes(doc) || doc.includes(pDoc) // fallback
                  })
                  if (matchDoc || lista.length > 0) { // Se retornou na busca exata por CPF, confiamos
                    clientesExistentesCA.add(doc)
                  }
                }
              } else {
                const errText = await res.text()
                console.warn(`[duplicidade-cliente] Erro ${res.status} ao buscar ${doc}: ${errText.substring(0, 200)}`)
              }
            } catch (err) {
              console.warn(`[duplicidade-cliente] Erro ao buscar vendas anteriores ${doc} no CA:`, err)
            }
          }))
        }
        
        // Para cada venda ainda sem ca_status, marca se o cliente já existe
        for (const venda of dadosFiltrados) {
          if (!(venda as any).ca_status) {
            const doc = (venda as any).cliente_cpf_cnpj?.replace(/\D/g, '') || ''
            if (clientesExistentesCA.has(doc)) {
              ;(venda as any).ca_status = 'cliente_existente'
            }
          }
        }
      }

    } catch (caErr) {
      // Se o CA não está conectado ou deu qualquer erro, simplesmente segue sem marcação
      console.log('[duplicidade] Não foi possível verificar duplicidade no CA (pode não estar conectado):', (caErr as any)?.message || caErr)
    }
    // --- FIM DA DETECÇÃO DE DUPLICIDADE E CLIENTE ---

    const validos = dadosFiltrados.filter(d => d.valido).length
    const invalidos = dadosFiltrados.filter(d => !d.valido).length

    // Montar diagnóstico dos campos reais vindos do Datacar
    const _diagnostico: Record<string, unknown> = {}
    if (allOS.length > 0) {
      if (allOS[0].produtos?.length > 0) {
        _diagnostico.primeiro_produto_campos = Object.keys(allOS[0].produtos[0])
        _diagnostico.primeiro_produto_valores = allOS[0].produtos[0]
      }
      if (allOS[0].servicos?.length > 0) {
        _diagnostico.primeiro_servico_campos = Object.keys(allOS[0].servicos[0])
        _diagnostico.primeiro_servico_valores = allOS[0].servicos[0]
      }
    }

    return NextResponse.json({
      total: dadosFiltrados.length,
      validos,
      invalidos,
      dados: dadosFiltrados,
      empresa_nome: empresa.nome,
      _diagnostico,
    })

  } catch (err: unknown) {
    console.error('Erro ao buscar OS/Pedidos do Datacar:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
