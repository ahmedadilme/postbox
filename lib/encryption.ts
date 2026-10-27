import "server-only"
import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Validate encryption key at module load time to fail fast if misconfigured
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("Missing ENCRYPTION_KEY environment variable (32 hex bytes = 64 chars)")
  if (raw.length !== 64) throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)")
  try {
    return Buffer.from(raw, "hex")
  } catch {
    throw new Error("ENCRYPTION_KEY must be valid hexadecimal")
  }
}

// Eagerly validate on import
getKey()

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${tag}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivHex, tagHex, encrypted] = ciphertext.split(":")
  if (!ivHex || !tagHex || !encrypted) throw new Error("Invalid ciphertext format")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}
