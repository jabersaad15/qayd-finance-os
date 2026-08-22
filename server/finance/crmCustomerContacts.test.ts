import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customerContacts, customers, quotations } from "../../drizzle/schema";
import { salesQuotationRoles } from "./roleAccess";

describe("CRM customer contacts and sales ownership", () => {
  it("يوفر حقول جهة الاتصال الأساسية وموظف المبيعات المسؤول للعميل", () => {
    const columns = getTableColumns(customers);
    expect(columns.primaryContactName).toBeDefined();
    expect(columns.primaryContactEmail).toBeDefined();
    expect(columns.primaryContactPhone).toBeDefined();
    expect(columns.salesOwnerUserId).toBeDefined();
    expect(salesQuotationRoles).toContain("sales");
  });

  it("يربط جهة الاتصال ومسؤول المبيعات بعرض السعر ويعزل الاتصال بالعميل", () => {
    const contactColumns = getTableColumns(customerContacts);
    const quotationColumns = getTableColumns(quotations);
    expect(contactColumns.customerId).toBeDefined();
    expect(contactColumns.isPrimary).toBeDefined();
    expect(quotationColumns.customerContactId).toBeDefined();
    expect(quotationColumns.salesOwnerUserId).toBeDefined();
  });
});
