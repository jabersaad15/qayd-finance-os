import { auditLogs } from "../../drizzle/schema";
import { assertAuditAppendOnly } from "./guards";

export type AuditLogEntry = {
  tenantId: number;
  companyId?: number;
  actorUserId?: number;
  action: string;
  entityType: string;
  entityId: number;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
};

type AuditLogWriter = {
  insert: (table: typeof auditLogs) => { values: (entry: AuditLogEntry) => Promise<unknown> };
};

/** نقطة الكتابة الوحيدة المسموحة لسجل التدقيق؛ لا تتضمن هذه الواجهة أي تعديل أو حذف. */
export async function appendAuditLog(writer: AuditLogWriter, entry: AuditLogEntry) {
  assertAuditAppendOnly("insert");
  return writer.insert(auditLogs).values(entry);
}
