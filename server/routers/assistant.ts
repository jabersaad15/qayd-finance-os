import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { accounts, journalEntries, journalLines, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { appendAuditLog } from "../finance/auditLog";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const member = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

export const assistantRouter = router({
  ask: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), question: z.string().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const balance = await db.select({ code: accounts.code, nameAr: accounts.nameAr, accountType: accounts.accountType, debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`, credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id)).innerJoin(accounts, eq(journalLines.accountId, accounts.id)).where(and(eq(journalLines.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId), eq(journalEntries.status, "posted"))).groupBy(accounts.id, accounts.code, accounts.nameAr, accounts.accountType);
    const [period] = await db.select({ startDate: sql<string | null>`min(${journalEntries.entryDate})`, endDate: sql<string | null>`max(${journalEntries.entryDate})` }).from(journalEntries).where(and(eq(journalEntries.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId), eq(journalEntries.status, "posted")));
    const generatedAt = new Date().toISOString();
    const source = { report: "trial_balance", generatedAt, periodStart: period?.startDate ?? null, periodEnd: period?.endDate ?? null, entries: balance };
    if (balance.length === 0) return { answer: "لا توجد قيود مرحلة كافية في الشركة لهذه الفترة. لا يمكنني تقديم تحليل مالي موثوق قبل تسجيل وترحيل بيانات فعلية.", sourceLabel: "ميزان مراجعة القيود المرحلة", entryCount: 0, periodStart: null, periodEnd: null, generatedAt } as const;
    const response = await invokeLLM({ model: "gpt-5-mini", maxTokens: 900, messages: [{ role: "system", content: "أنت مساعد مالي تفسيري لمنصة محاسبية سعودية. استخدم فقط بيانات ميزان المراجعة المعطاة. لا تخترع أرقاماً أو مصادر، لا تقدم فتوى ضريبية أو قانونية، ولا تصدر أو تعتمد أو ترحل أي قيد. اذكر بوضوح إن كانت البيانات فارغة أو غير كافية. أجب بالعربية في فقرات قصيرة، واذكر أسماء الحسابات أو أكوادها المستخدمة عند توفرها." }, { role: "user", content: `السؤال: ${input.question}\n\nبيانات مصدر القراءة فقط:\n${JSON.stringify(source)}` }] });
    const content = response.choices[0]?.message.content;
    const answer = typeof content === "string" ? content : content?.filter((part) => part.type === "text").map((part) => part.text).join("\n") || "تعذر إنشاء إجابة تفسيرية.";
    await appendAuditLog(db, { tenantId: input.tenantId, companyId: input.companyId, actorUserId: ctx.user.id, action: "assistant.asked", entityType: "assistant_query", entityId: 0, newValue: { question: input.question, source: "trial_balance" } });
    return { answer, sourceLabel: "ميزان مراجعة القيود المرحلة", entryCount: balance.length, periodStart: source.periodStart, periodEnd: source.periodEnd, generatedAt };
  }),
});
