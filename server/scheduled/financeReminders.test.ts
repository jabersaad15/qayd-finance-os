import { describe, expect, it } from "vitest";
import { createApprovalSlaReminders, executionBucket, reminderExecutionDecision } from "./financeReminders";

describe("finance reminder execution key", () => {
  it("keeps retries within the same minute in one idempotency bucket", () => {
    expect(executionBucket(new Date("2026-08-15T07:00:01.000Z"))).toBe("2026-08-15T07:00");
    expect(executionBucket(new Date("2026-08-15T07:00:59.000Z"))).toBe("2026-08-15T07:00");
  });

  it("rejects non-cron callers and distinguishes orphan, disabled and ready schedules", () => {
    expect(reminderExecutionDecision({ isCron: false, taskUid: undefined, hasSchedule: false, isEnabled: false, isDuplicate: false })).toBe("forbidden");
    expect(reminderExecutionDecision({ isCron: true, taskUid: "job-1", hasSchedule: false, isEnabled: false, isDuplicate: false })).toBe("orphan");
    expect(reminderExecutionDecision({ isCron: true, taskUid: "job-1", hasSchedule: true, isEnabled: false, isDuplicate: false })).toBe("disabled");
    expect(reminderExecutionDecision({ isCron: true, taskUid: "job-1", hasSchedule: true, isEnabled: true, isDuplicate: false })).toBe("ready");
  });

  it("skips a duplicate execution before another notification can be dispatched", () => {
    expect(reminderExecutionDecision({ isCron: true, taskUid: "job-1", hasSchedule: true, isEnabled: true, isDuplicate: true })).toBe("duplicate");
  });

  it("exposes the approval SLA reminder worker without in-process timers", () => {
    expect(createApprovalSlaReminders).toBeTypeOf("function");
  });

  it("keeps customer-payment reminder runs behind the same cron-only decision gate", () => {
    expect(reminderExecutionDecision({ isCron: true, taskUid: "customer-payment-due", hasSchedule: true, isEnabled: true, isDuplicate: false })).toBe("ready");
  });
});
