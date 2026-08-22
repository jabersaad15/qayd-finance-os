import { describe, expect, it } from "vitest";
import { createCustomerPortalSecret, hashCustomerPortalSecret, isPortalTokenUsable, portalExpiration } from "./customerPortal";

describe("customer portal security", () => {
  it("generates a high-entropy secret and a deterministic one-way hash", () => {
    const secret = createCustomerPortalSecret();
    expect(secret.length).toBeGreaterThanOrEqual(40);
    expect(hashCustomerPortalSecret(secret)).toHaveLength(64);
    expect(hashCustomerPortalSecret(secret)).toBe(hashCustomerPortalSecret(secret));
    expect(hashCustomerPortalSecret(secret)).not.toContain(secret);
  });

  it("accepts only active, non-expired tokens", () => {
    const now = new Date("2026-08-16T00:00:00.000Z");
    expect(isPortalTokenUsable("active", portalExpiration(30, now), now)).toBe(true);
    expect(isPortalTokenUsable("revoked", portalExpiration(30, now), now)).toBe(false);
    expect(isPortalTokenUsable("active", new Date("2026-08-15T23:59:59.000Z"), now)).toBe(false);
  });
});
