// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  errorMessage: "ZATCA_INVALID_OTP: OTP=123456",
  toastError: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    zatca: {
      settings: { useQuery: () => ({ data: { egs: [{ id: 4, deviceName: "QAYD EGS Simulation", serialNumber: "QAYD-EGS-SIM-001", connectionStatus: "failed", complianceCsidStatus: "failed", csrStatus: "issued" }] }, refetch: vi.fn() }) },
      generateCsr: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      createEgs: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      startComplianceOnboarding: { useMutation: (options: { onError: (error: Error) => void }) => ({ isPending: false, mutate: (input: unknown) => { mocks.mutate(input); options.onError(new Error(mocks.errorMessage)); } }) },
    },
  },
}));

import { ZatcaSettingsPanel } from "./ZatcaSettingsPanel";

afterEach(() => { cleanup(); mocks.mutate.mockReset(); mocks.toastError.mockReset(); });

describe("ZatcaSettingsPanel onboarding errors", () => {
  it.each([
    ["ZATCA_INVALID_OTP: OTP=123456", "رمز OTP غير صالح أو منتهٍ"],
    ["ZATCA_INVALID_CSR: secret=do-not-show", "رفضت ZATCA طلب CSR"],
    ["ZATCA_ENVIRONMENT_OR_REGISTRATION_MISMATCH: token=do-not-show", "لم تطابق ZATCA الطلب مع البيئة أو بيانات التسجيل"],
  ])("يعرض تصنيف الخطأ الآمن في DOM دون بيانات حساسة: %s", (errorMessage, expectedNotice) => {
    mocks.errorMessage = errorMessage;
    render(<ZatcaSettingsPanel tenantId={1} companyId={1} />);
    fireEvent.change(screen.getByLabelText("رمز OTP للمحاكاة"), { target: { value: "123456" } });
    fireEvent.change(screen.getByPlaceholderText("-----BEGIN CERTIFICATE REQUEST-----"), { target: { value: "-----BEGIN CERTIFICATE REQUEST-----\nSAFE\n-----END CERTIFICATE REQUEST-----" } });
    fireEvent.click(screen.getByRole("button", { name: "بدء ربط ZATCA" }));
    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain(expectedNotice);
    expect(notice.textContent).not.toContain("123456");
    expect(notice.textContent).not.toContain("do-not-show");
    expect(mocks.toastError).toHaveBeenCalledWith(expect.not.stringContaining("123456"));
    expect(mocks.mutate).toHaveBeenCalledOnce();
  });
});
