import { describe, expect, it } from "vitest";

describe("product title configuration", () => {
  it("uses قيد | QAYD as the product title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("قيد | QAYD");
  });
});
