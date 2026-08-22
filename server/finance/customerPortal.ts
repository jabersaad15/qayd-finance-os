import { createHash, randomBytes } from "node:crypto";

export function createCustomerPortalSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerPortalSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function isPortalTokenUsable(status: string, expiresAt: Date | string, now = new Date()) {
  return status === "active" && new Date(expiresAt).getTime() > now.getTime();
}

export function portalExpiration(days: number, now = new Date()) {
  const safeDays = Math.min(90, Math.max(1, Math.trunc(days)));
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}
