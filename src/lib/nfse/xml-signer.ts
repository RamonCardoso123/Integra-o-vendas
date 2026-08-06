import forge from 'node-forge'
import { SignedXml } from 'xml-crypto'

export interface CertificadoData {
  certPem: string
  keyPem: string
}

/**
 * Lê o arquivo PFX, valida a senha (descriptografa o conteúdo) e extrai
 * a Chave Privada (keyPem) e o Certificado (certPem) em formato PEM para a assinatura.
 */
export async function extrairCertificadoPfx(pfxBuffer: Buffer, senhaPfx: string): Promise<CertificadoData> {
  try {
    // Converte buffer para string binária (necessário no node-forge)
    const pfxDer = pfxBuffer.toString('binary')
    
    // Lê o PFX (Asn1)
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    
    // Tenta abrir o cofre usando a senha
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, senhaPfx)

    let certPem = ''
    let keyPem = ''

    // Extrai a chave privada e o certificado
    for (const safeContent of pfx.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.certBag) {
          const cert = safeBag.cert
          if (cert) {
            certPem = forge.pki.certificateToPem(cert)
          }
        } else if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          const key = safeBag.key
          if (key) {
            keyPem = forge.pki.privateKeyToPem(key)
          }
        }
      }
    }

    if (!certPem || !keyPem) {
      throw new Error('Certificado ou chave privada não encontrados dentro do arquivo PFX.')
    }

    return { certPem, keyPem }
  } catch (err: unknown) {
    console.error('[xml-signer] Erro ao extrair certificado:', err)
    if (err instanceof Error && err.message.includes('PKCS#12 MAC could not be verified')) {
      throw new Error('Senha do certificado incorreta.')
    }
    throw new Error('Falha ao processar o arquivo de certificado (.pfx). Verifique se o formato está correto.')
  }
}

/**
 * Assina um documento XML seguindo o padrão XMLDSig (exigido pela ABRASF / Gov.br).
 * @param xml XML em string
 * @param certData Objeto contendo certPem e keyPem
 * @param referenceUri ID da tag que será assinada (ex: infDPS)
 */
export function assinarXmlNfse(xml: string, certData: CertificadoData, referenceUri: string): string {
  const sig = new SignedXml({
    privateKey: certData.keyPem,
    publicCert: certData.certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    getKeyInfoContent: () => {
      const certClean = certData.certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\\n/g, '')
        .replace(/\\r/g, '')
      return `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`
    }
  })
  
  sig.addReference({
    xpath: `//*[@Id='${referenceUri}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  })

  // Gera a assinatura computando os hashes
  sig.computeSignature(xml, {
    location: { reference: `//*[@Id='${referenceUri}']`, action: 'after' }
  })

  return sig.getSignedXml()
}
