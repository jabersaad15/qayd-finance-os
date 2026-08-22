import { describe, expect, it } from "vitest";
import { hashEmployeePassword, normalizeUsername, resolveEmployeeUsername, usernameFromEmail, verifyEmployeePassword } from "./employeeAuth";
import { buildEmployeeInvitationEmail } from "./employeeInvitationEmail";

describe("employee invitation credentials", () => {
  it("يخزن كلمة المرور بصيغة مشفرة قابلة للتحقق دون كشفها", () => {
    const hash = hashEmployeePassword("Temporary123!");
    expect(hash).not.toContain("Temporary123!");
    expect(verifyEmployeePassword("Temporary123!", hash)).toBe(true);
    expect(verifyEmployeePassword("Wrong123!", hash)).toBe(false);
  });

  it("يطبع اسم المستخدم وكلمة المرور المؤقتة ورابط الدخول في رسالة الدعوة", () => {
    const email = buildEmployeeInvitationEmail({ to: "employee@example.com", displayName: "موظف جديد", username: "sales.user", temporaryPassword: "Temporary123!", roleName: "المبيعات", publicAppUrl: "https://consedra.com/login" });
    expect(email.subject).toContain("قيد | QAYD");
    expect(email.text).toContain("sales.user");
    expect(email.text).toContain("Temporary123!");
    expect(email.html).toContain("https://consedra.com/login");
    expect(email.text).toContain("/terms");
    expect(email.text).toContain("/privacy");
    expect(email.html).toContain("الشروط والأحكام");
    expect(email.html).toContain("سياسة الخصوصية");
  });

  it("يوحد اسم المستخدم دون تغيير الحروف المسموحة", () => {
    expect(normalizeUsername(" Sales.User ")).toBe("sales.user");
  });

  it("يولد اسم مستخدم صالحاً من البريد عند ترك الحقل فارغاً", () => {
    expect(usernameFromEmail("Bayaaahmed50@gmail.com")).toBe("bayaaahmed50");
    expect(resolveEmployeeUsername("Bayaaahmed50@gmail.com")).toBe("bayaaahmed50");
  });

  it("لا يمرر البريد الإلكتروني كاسم مستخدم تقني", () => {
    expect(resolveEmployeeUsername("Bayaaahmed50@gmail.com", "Bayaaahmed50@gmail.com")).toBe("bayaaahmed50");
  });
});
