import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt";

export function hashEmployeePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${derived}`;
}

export function verifyEmployeePassword(password: string, storedHash: string) {
  const [prefix, salt, expectedHex] = storedHash.split("$");
  if (prefix !== SCRYPT_PREFIX || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

/** Builds a username accepted by the local-login policy without exposing the email address as a username. */
export function usernameFromEmail(email: string) {
  const localPart = email.trim().toLowerCase().split("@")[0] || "user";
  const sanitized = localPart.replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "");
  const base = (sanitized || "user").slice(0, 76);
  return base.length >= 3 ? base : `user-${base}`.slice(0, 80);
}

export function resolveEmployeeUsername(email: string, requestedUsername?: string) {
  const requested = requestedUsername?.trim();
  return normalizeUsername(requested && !requested.includes("@") ? requested : usernameFromEmail(email));
}
