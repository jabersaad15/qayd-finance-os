import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getDb: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { financeRemindersHandler } from "./financeReminders";

function response() {
  const res = { status: vi.fn(), json: vi.fn() } as any;
  res.status.mockReturnValue(res);
  return res;
}

function database(selectResults: unknown[][], lockValues: ReturnType<typeof vi.fn>) {
  const limit = vi.fn(() => Promise.resolve(selectResults.shift() ?? []));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return {
    select: vi.fn(() => ({ from })),
    insert: vi.fn(() => ({ values: lockValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  };
}

describe("financeRemindersHandler integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifyOwner.mockResolvedValue(true);
  });

  it("rejects requests that are not authenticated as cron", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await financeRemindersHandler({ originalUrl: "/api/scheduled/finance-reminders" } as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("skips an orphaned or disabled task without dispatching a notification", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const lock = vi.fn().mockResolvedValue({});
    mocks.getDb.mockResolvedValue(database([[]], lock));
    const orphanRes = response();
    await financeRemindersHandler({ originalUrl: "/api/scheduled/finance-reminders" } as any, orphanRes);
    expect(orphanRes.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
    expect(mocks.notifyOwner).not.toHaveBeenCalled();

    mocks.getDb.mockResolvedValue(database([[{ id: 3, isEnabled: false }]], lock));
    const disabledRes = response();
    await financeRemindersHandler({ originalUrl: "/api/scheduled/finance-reminders" } as any, disabledRes);
    expect(disabledRes.json).toHaveBeenCalledWith({ ok: true, skipped: "disabled" });
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });

  it("dispatches one notification for a valid schedule and skips a duplicate retry", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-2" });
    const lock = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("duplicate"));
    mocks.getDb.mockResolvedValue(database([[{ id: 5, isEnabled: true, reminderType: "vat_due", companyId: 9 }], [{ legalNameAr: "شركة مثال" }]], lock));
    const first = response();
    await financeRemindersHandler({ originalUrl: "/api/scheduled/finance-reminders" } as any, first);
    expect(first.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, scheduleId: 5, notificationAccepted: true }));
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);

    const retry = response();
    await financeRemindersHandler({ originalUrl: "/api/scheduled/finance-reminders" } as any, retry);
    expect(retry.json).toHaveBeenCalledWith({ ok: true, skipped: "duplicate" });
    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
  });
});
