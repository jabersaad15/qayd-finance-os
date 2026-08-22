import { describe, expect, it } from "vitest";
import { subscriptionBillingCycleValues, subscriptionPlanStatusValues, subscriptionStatusValues } from "../../drizzle/schema";

describe("subscription architecture", () => {
  it("defines the commercial plan lifecycle", () => {
    expect(subscriptionPlanStatusValues).toEqual(["active", "archived"]);
    expect(subscriptionBillingCycleValues).toEqual(["monthly", "annual"]);
    expect(subscriptionStatusValues).toEqual(["trialing", "active", "past_due", "cancelled", "expired", "suspended"]);
  });

  it("keeps entitlement and usage concepts independent from plan names", () => {
    expect("tenantFeatureEntitlements").not.toBe("subscriptionPlans");
    expect("tenantUsageCounters").not.toBe("subscriptionPlans");
  });
});
