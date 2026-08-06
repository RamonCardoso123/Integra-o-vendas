import { XMLBuilder } from 'fast-xml-parser'

export interface DadosDPS {
  numeroOS: string
  dataCompetencia: string
  valorServico: number
  descricao: string
  cliente: {
    documento: string
    nome: string
    cidade: string // Código IBGE do município
    cep?: string
    logradouro?: string
    numero?: string
    bairro?: string
  }
  emitente: {
    cnpj: string
    inscricaoMunicipal: string
    regimeTributario: number // Regime de Apuração dos Tributos no Simples Nacional
  }
  codigoTributarioNacional?: string
  codigoComplementarMunicipal?: string
  itemNBS?: string
  aliquotaSimplesNacional?: number
  aliquotaIssqn?: number
}

/**
 * Cria a estrutura base do XML do DPS Padrão Nacional.
 * Esta versão é um mockup simplificado para a fase de testes,
 * mas parametrizada com os dados reais do Contribuinte.
 */
export function buildDPSXml(dados: DadosDPS): string {
  const options = {
    ignoreAttributes: false,
    format: true,
  }
  const builder = new XMLBuilder(options)

  const docOriginal = dados.cliente.documento ? dados.cliente.documento.replace(/\D/g, '') : ''
  const isCNPJ = docOriginal.length > 11

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    DPS: {
      '@_xmlns': 'http://www.sped.fazenda.gov.br/nfse',
      infDPS: {
        '@_Id': `DPS${dados.numeroOS}`,
        '@_versao': '1.00',
        tpAmb: 2, // 1 = Produção, 2 = Homologação
        dhEmi: dados.dataCompetencia, // Data de emissão real
        prest: {
          CNPJ: dados.emitente.cnpj.replace(/\D/g, ''),
          IM: dados.emitente.inscricaoMunicipal.replace(/\D/g, ''),
        },
        toma: {
          CNPJ: isCNPJ && docOriginal ? docOriginal : undefined,
          CPF: !isCNPJ && docOriginal ? docOriginal : undefined,
          xNome: dados.cliente.nome,
          end: dados.cliente.cep ? {
            CEP: dados.cliente.cep.replace(/\D/g, ''),
            xLgr: dados.cliente.logradouro || 'NÃO INFORMADO',
            nro: dados.cliente.numero || 'SN',
            xBairro: dados.cliente.bairro || 'NÃO INFORMADO',
            cMun: dados.cliente.cidade, // IBGE
            cPais: '1058', // Brasil
          } : undefined
        },
        // intermediário não informado - Omitido propositalmente (padrão)
        serv: {
          locPrest: dados.cliente.cidade, // Município onde foi prestado
          cTribNac: dados.codigoTributarioNacional || '14.01.01',
          cTribMun: dados.codigoComplementarMunicipal || '14.01.01.001',
          cNBS: dados.itemNBS || '120013110',
          xDesc: dados.descricao,
        },
        valores: {
          vServPrest: {
            vRec: dados.valorServico.toFixed(2),
          },
          trib: {
            tribMun: {
              tribISSQN: 1, // 1 = Operação tributável
              cLocIncid: dados.cliente.cidade, // Município de incidência do ISSQN
              pAliq: dados.aliquotaIssqn ? dados.aliquotaIssqn.toFixed(2) : undefined, // Alíquota do ISS (se exigido pela prefeitura/retido)
              tpRetISSQN: 2, // 2 = Não retido pelo Tomador
            },
            tribFed: {
              piscofins: {
                cst: '00', // 00 - Nenhum
              }
            },
            totTrib: {
              pAliqSN: dados.aliquotaSimplesNacional ? dados.aliquotaSimplesNacional.toFixed(2) : '11.34'
            }
          }
        }
      }
    }
  }

  // Remove campos com undefined para não poluir o XML
  const cleanObj = (obj: any) => {
    Object.keys(obj).forEach(key => {
      if (obj[key] && typeof obj[key] === 'object') {
        cleanObj(obj[key])
        if (Object.keys(obj[key]).length === 0) delete obj[key]
      }
      else if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
        delete obj[key]
      }
    })
  }
  cleanObj(doc)

  return builder.build(doc)
}
