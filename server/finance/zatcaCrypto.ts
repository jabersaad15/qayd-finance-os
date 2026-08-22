import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ENV } from "../_core/env";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 16) {
    throw new Error("ZATCA secret encryption is unavailable because the server key is not configured.");
  }
  return createHash("sha256").update(`qayd-zatca:${ENV.cookieSecret}`).digest();
}

export function encryptZatcaSecret(value: string) {
  if (!value) throw new Error("Cannot encrypt an empty ZATCA secret.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptZatcaSecret(payload: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted ZATCA secret.");
  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("Invalid encrypted ZATCA secret.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function redactZatcaError(error: unknown) {
  const message = error instanceof Error ? error.message : "ZATCA request failed.";
  return message.replace(/(otp|secret|token|authorization|password|private.?key)\s*[:=]\s*[^,;\s]+/gi, "$1=[REDACTED]");
}
