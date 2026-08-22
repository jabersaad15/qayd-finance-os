import { describe, expect, it, vi } from "vitest";
import * as db from "../db";
import { recordSecurityEvent } from "../_core/localAuth";

vi.mock("../db", () => ({ getDb: vi.fn() }));

describe("local authentication security audit isolation", () => {
  it("لا يرمي خطأً عندما يفشل حفظ حدث الأمان", async () => {
    vi.mocked(db.getDb).mockResolvedValue({
      insert: () => ({ values: vi.fn().mockRejectedValue(new Error("securityEvents unavailable")) }),
    } as never);

    await expect(recordSecurityEvent({ userId: 219, eventType: "login_success", ipAddress: "127.0.0.1", userAgent: "test" })).resolves.toBeUndefined();
  });
});
