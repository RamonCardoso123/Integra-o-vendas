/**
 * Utilitário de Criptografia AES-256-GCM
 * Usado exclusivamente para proteger senhas de certificados digitais A1
 * 
 * A Master Key é lida de process.env.CERT_MASTER_KEY e NUNCA é exposta ao frontend.
 */
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16  // 128 bits
const AUTH_TAG_LENGTH = 16

function getMasterKey(): Buffer {
  const key = process.env.CERT_MASTER_KEY
  if (!key) {
    throw new Error('CERT_MASTER_KEY não configurada nas variáveis de ambiente. Gere uma com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
  // A chave pode estar em hex (64 chars) ou base64
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex')
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`CERT_MASTER_KEY deve ter exatamente ${KEY_LENGTH} bytes (64 caracteres hex ou 44 caracteres base64). Atual: ${buf.length} bytes.`)
  }
  return buf
}

/**
 * Criptografa um texto (a senha do certificado) usando AES-256-GCM.
 * Retorna um objeto com o texto cifrado (hex), o IV (hex) e o authTag (hex).
 */
export function encryptPassword(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  }
}

/**
 * Descriptografa a senha do certificado a partir dos dados criptografados.
 */
export function decryptPassword(encrypted: string, ivHex: string, authTagHex: string): string {
  const key = getMasterKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Formato compacto: armazena tudo em uma string só (encrypted:iv:authTag)
 * Usado para salvar no banco de dados em um único campo.
 */
export function encryptPasswordCompact(plaintext: string): string {
  const { encrypted, iv, authTag } = encryptPassword(plaintext)
  return `${encrypted}:${iv}:${authTag}`
}

/**
 * Descriptografa a partir do formato compacto.
 */
export function decryptPasswordCompact(compactString: string): string {
  const parts = compactString.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de senha criptografada inválido. Esperado: encrypted:iv:authTag')
  }
  return decryptPassword(parts[0], parts[1], parts[2])
}
