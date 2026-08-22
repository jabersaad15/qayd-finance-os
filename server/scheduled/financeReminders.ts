import type { Request, Response } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { approvalCases, companies, customerPaymentReminderEvents, customers, financialReminderSchedules, internalNotifications, invoices, scheduledExecutionLocks } from "../../drizzle/schema";
import { getDb } from "../db";
import { subtractMoney } from "../finance/invariants";
import { notifyOwner } from "../_core/notification";
import { sdk } from "../_core/sdk";
import { sendPaymentReminderEmail } from "../finance/customerPaymentReminderEmail";
import { PRODUCT_BRAND } from "../../shared/productBrand";

const labels = { vat_due: "تذكير موعد VAT", financial_digest: "ملخص مالي دوري", approval_pending: "طلبات اعتماد معلقة", customer_payment_due: "تذكير مستحقات العملاء" } as const;

export function executionBucket(date: Date) { return date.toISOString().slice(0, 16); }

export function reminderExecutionDecision(input: { isCron?: boolean; taskUid?: string; hasSchedule: boolean; isEnabled: boolean; isDuplicate: boolean }) {
  if (!input.isCron || !input.taskUid) return "forbidden" as const;
  if (input.isDuplicate) return "duplicate" as const;
  if (!input.hasSchedule) return "orphan" as const;
  if (!input.isEnabled) return "disabled" as const;
  return "ready" as const;
}

function utcDay(date = new Date()) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }

export async function createApprovalSlaReminders(input: { tenantId: number; companyId: number; now?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("database-unavailable");
  const now = input.now ?? new Date();
  const dueLimit = new Date(now.getTime() + 24 * 3600000);
  const rows = await db.select({ id: approvalCases.id, requestNumber: approvalCases.requestNumber, requestedByUserId: approvalCases.requestedByUserId, dueAt: approvalCases.dueAt, priority: approvalCases.priority }).from(approvalCases).where(and(eq(approvalCases.tenantId, input.tenantId), eq(approvalCases.companyId, input.companyId), eq(approvalCases.status, "pending"), lte(approvalCases.dueAt, dueLimit)));
  const created: number[] = [];
  const recentCutoff = new Date(now.getTime() - 24 * 3600000);
  for (const row of rows) {
    if (!row.dueAt) continue;
    const [recent] = await db.select({ id: internalNotifications.id }).from(internalNotifications).where(and(eq(internalNotifications.tenantId, input.tenantId), eq(internalNotifications.companyId, input.companyId), eq(internalNotifications.entityType, "approval_case"), eq(internalNotifications.entityId, row.id), eq(internalNotifications.eventType, "central.approval.sla_reminder"), gte(internalNotifications.createdAt, recentCutoff))).limit(1);
    if (recent) continue;
    await db.insert(internalNotifications).values({ tenantId: input.tenantId, companyId: input.companyId, recipientUserId: row.requestedByUserId, eventType: "central.approval.sla_reminder", titleAr: row.dueAt.getTime() < now.getTime() ? "طلب موافقة متأخر" : "اقتراب موعد الموافقة", bodyAr: `الطلب ${row.requestNumber} يحتاج متابعة قبل ${row.dueAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`, entityType: "approval_case", entityId: row.id });
    created.push(row.id);
  }
  return created;
}

export async function createCustomerPaymentDueReminders(input: { tenantId: number; companyId: number; now?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("database-unavailable");
  const today = utcDay(input.now);
  const upcomingLimit = new Date(today); upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 7);
  const rows = await db.select({ invoiceId: invoices.id, invoiceNumber: invoices.invoiceNumber, invoiceStatus: invoices.status, dueDate: invoices.dueDate, grandTotal: invoices.grandTotal, paidTotal: invoices.paidTotal, customerId: customers.id, customerName: customers.name, customerEmail: customers.email, salesOwnerUserId: customers.salesOwnerUserId }).from(invoices).innerJoin(customers, eq(customers.id, invoices.customerId)).where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId), lte(invoices.dueDate, upcomingLimit)));
  const created: { invoiceNumber: string; customerName: string; outstanding: string; reminderKind: "upcoming" | "overdue"; dueDate: Date }[] = [];
  for (const row of rows) {
    if (!row.dueDate || ["draft", "pending_approval", "rejected", "credit_note_issued"].includes(row.invoiceStatus)) continue;
    const outstanding = subtractMoney(row.grandTotal, row.paidTotal);
    if (outstanding === "0.000000" || outstanding.startsWith("-")) continue;
    const dueDate = utcDay(row.dueDate);
    const reminderKind = dueDate.getTime() < today.getTime() ? "overdue" as const : "upcoming" as const;
    try {
      await db.insert(customerPaymentReminderEvents).values({ tenantId: input.tenantId, companyId: input.companyId, customerId: row.customerId, invoiceId: row.invoiceId, reminderDate: today, reminderKind });
    } catch {
      continue;
    }
    await db.insert(internalNotifications).values({ tenantId: input.tenantId, companyId: input.companyId, recipientUserId: row.salesOwnerUserId, eventType: `customer.payment_${reminderKind}`, titleAr: reminderKind === "overdue" ? "دفعة عميل متأخرة" : "استحقاق عميل قريب", bodyAr: `${row.customerName}: الفاتورة ${row.invoiceNumber} لها رصيد ${outstanding} SAR وتاريخ استحقاق ${dueDate.toISOString().slice(0, 10)}.`, entityType: "invoice", entityId: row.invoiceId });
    if (row.customerEmail) {
      try { await sendPaymentReminderEmail({ to: row.customerEmail, customerName: row.customerName, invoiceNumber: row.invoiceNumber, outstanding, dueDate: dueDate.toISOString().slice(0, 10), companyName: PRODUCT_BRAND.bilingual, publicAppUrl: process.env.PUBLIC_APP_URL }); } catch { /* يبقى التنبيه الداخلي وسجل الحدث فعالين عند تعذر SMTP المؤقت */ }
    }
    created.push({ invoiceNumber: row.invoiceNumber, customerName: row.customerName, outstanding, reminderKind, dueDate });
  }
  return created;
}

export async function financeRemindersHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (reminderExecutionDecision({ isCron: user.isCron, taskUid: user.taskUid, hasSchedule: true, isEnabled: true, isDuplicate: false }) === "forbidden") return res.status(403).json({ error: "cron-only" });
    const taskUid = user.taskUid!;
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    try { await db.insert(scheduledExecutionLocks).values({ taskUid, executionBucket: executionBucket(new Date()) }); } catch { return res.json({ ok: true, skipped: "duplicate" }); }
    const [schedule] = await db.select().from(financialReminderSchedules).where(eq(financialReminderSchedules.scheduleCronTaskUid, taskUid)).limit(1);
    const decision = reminderExecutionDecision({ isCron: user.isCron, taskUid, hasSchedule: Boolean(schedule), isEnabled: Boolean(schedule?.isEnabled), isDuplicate: false });
    if (decision === "orphan" || decision === "disabled") return res.json({ ok: true, skipped: decision });
    const [company] = await db.select({ legalNameAr: companies.legalNameAr }).from(companies).where(eq(companies.id, schedule.companyId)).limit(1);
    if (schedule.reminderType === "approval_pending") {
      const reminders = await createApprovalSlaReminders({ tenantId: schedule.tenantId, companyId: schedule.companyId });
      const accepted = reminders.length ? await notifyOwner({ title: labels.approval_pending, content: `${company?.legalNameAr ?? "الشركة"}: تم إنشاء ${reminders.length} تذكير SLA لطلبات الموافقة.` }) : false;
      await db.update(financialReminderSchedules).set({ lastTriggeredAt: new Date() }).where(eq(financialReminderSchedules.id, schedule.id));
      return res.json({ ok: true, scheduleId: schedule.id, remindersCreated: reminders.length, notificationAccepted: accepted });
    }
    if (schedule.reminderType === "customer_payment_due") {
      const reminders = await createCustomerPaymentDueReminders({ tenantId: schedule.tenantId, companyId: schedule.companyId });
      const accepted = reminders.length ? await notifyOwner({ title: labels.customer_payment_due, content: `${company?.legalNameAr ?? "الشركة"}: تم تسجيل ${reminders.length} تنبيه مستحقات. راجع قسم العملاء للتحصيل والمتابعة.` }) : false;
      await db.update(financialReminderSchedules).set({ lastTriggeredAt: new Date() }).where(eq(financialReminderSchedules.id, schedule.id));
      return res.json({ ok: true, scheduleId: schedule.id, remindersCreated: reminders.length, notificationAccepted: accepted });
    }
    const title = labels[schedule.reminderType];
    const accepted = await notifyOwner({ title, content: `${title} — ${company?.legalNameAr ?? "شركة غير معروفة"}. راجع مركز ${PRODUCT_BRAND.bilingual} المالي لإتمام الإجراء.` });
    await db.update(financialReminderSchedules).set({ lastTriggeredAt: new Date() }).where(eq(financialReminderSchedules.id, schedule.id));
    return res.json({ ok: true, scheduleId: schedule.id, notificationAccepted: accepted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
