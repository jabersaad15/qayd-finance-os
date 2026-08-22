import { and, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { accounts, bankAccounts, bankReconciliationMatches, bankStatementLines, companies, costCenters, fiscalPeriods, invoices, journalEntries, journalLines, payments, projects, suppliers, tenantUsers } from "../../drizzle/schema";
import { getDb } from "../db";
import { addMoney, subtractMoney } from "../finance/invariants";
import { protectedProcedure, router } from "../_core/trpc";

const money = z.string().regex(/^\d+(\.\d{1,6})?$/);

async function accessCompany(userId: number, tenantId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حالياً." });
  const member = await db.select({ id: tenantUsers.id }).from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.companyId, companyId), eq(tenantUsers.status, "active"))).limit(1);
  if (!member[0]) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك حق الوصول إلى هذه الشركة." });
  return db;
}

async function openPeriodAndAccounts(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tenantId: number, companyId: number) {
  const [period] = await db.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, tenantId), eq(fiscalPeriods.companyId, companyId), eq(fiscalPeriods.status, "open"))).limit(1);
  if (!period) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد فترة محاسبية مفتوحة." });
  const accountRows = await db.select().from(accounts).where(and(eq(accounts.tenantId, tenantId), eq(accounts.companyId, companyId)));
  return { period, accounts: new Map(accountRows.map((account) => [account.code, account])) };
}

export const operationsRouter = router({
  createSupplier: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), name: z.string().min(2).max(255), vatNumber: z.string().max(32).optional(), email: z.string().email().optional() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const result = await db.insert(suppliers).values(input);
    return { id: Number(result[0].insertId) };
  }),

  recordExpense: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), supplierId: z.number().int().positive().optional(), costCenterId: z.number().int().positive().optional(), projectId: z.number().int().positive().optional(), entryNumber: z.string().min(3).max(64), entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: money, description: z.string().min(2).max(500) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const { period, accounts: accountMap } = await openPeriodAndAccounts(db, input.tenantId, input.companyId);
    const expense = accountMap.get("6100"); const payable = accountMap.get("2100");
    if (!expense || !payable) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا تتوفر حسابات المصروفات والموردين في دليل الحسابات." });
    if (input.costCenterId) {
      const [costCenter] = await db.select({ id: costCenters.id }).from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.tenantId, input.tenantId), eq(costCenters.companyId, input.companyId), eq(costCenters.isActive, true))).limit(1);
      if (!costCenter) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "مركز التكلفة المحدد غير نشط أو لا يتبع الشركة." });
    }
    if (input.projectId) {
      const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.tenantId, input.tenantId), eq(projects.companyId, input.companyId), eq(projects.status, "active"))).limit(1);
      if (!project) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المشروع المحدد غير نشط أو لا يتبع الشركة." });
    }
    return db.transaction(async (tx) => {
      const result = await tx.insert(journalEntries).values({ tenantId: input.tenantId, companyId: input.companyId, fiscalPeriodId: period.id, entryNumber: input.entryNumber, entryDate: new Date(input.entryDate), status: "posted", sourceType: "expense", description: input.description, debitTotal: input.amount, creditTotal: input.amount, createdByUserId: ctx.user.id, postedByUserId: ctx.user.id, postedAt: new Date() });
      const journalEntryId = Number(result[0].insertId);
      await tx.insert(journalLines).values([{ tenantId: input.tenantId, journalEntryId, accountId: expense.id, costCenterId: input.costCenterId, projectId: input.projectId, debit: input.amount, credit: "0.000000", description: input.description, lineOrder: 1 }, { tenantId: input.tenantId, journalEntryId, accountId: payable.id, supplierId: input.supplierId, debit: "0.000000", credit: input.amount, description: input.description, lineOrder: 2 }]);
      return { journalEntryId };
    });
  }),

  createBankAccount: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), bankName: z.string().min(2).max(255), iban: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const account = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.tenantId, input.tenantId), eq(accounts.companyId, input.companyId), eq(accounts.code, "1100"))).limit(1);
    if (!account[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكمل دليل الحسابات قبل إضافة الحساب البنكي." });
    const result = await db.insert(bankAccounts).values({ ...input, accountId: account[0].id });
    return { id: Number(result[0].insertId) };
  }),

  recordReceipt: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), invoiceId: z.number().int().positive(), bankAccountId: z.number().int().positive(), paymentNumber: z.string().min(3).max(64), paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: money, method: z.enum(["cash", "bank_transfer", "card", "cheque", "other"]).default("bank_transfer") })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const { period, accounts: accountMap } = await openPeriodAndAccounts(db, input.tenantId, input.companyId);
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId), eq(invoices.companyId, input.companyId))).limit(1);
    const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.tenantId, input.tenantId), eq(bankAccounts.companyId, input.companyId))).limit(1);
    const receivable = accountMap.get("1200");
    if (!invoice || !bank || !receivable) throw new TRPCError({ code: "NOT_FOUND", message: "الفاتورة أو الحساب البنكي أو حساب العملاء غير متاح." });
    const newPaidTotal = addMoney([invoice.paidTotal, input.amount]);
    const outstanding = subtractMoney(invoice.grandTotal, newPaidTotal);
    if (outstanding.startsWith("-")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن أن تتجاوز قيمة التحصيل إجمالي الفاتورة." });
    return db.transaction(async (tx) => {
      const paymentResult = await tx.insert(payments).values({ tenantId: input.tenantId, companyId: input.companyId, invoiceId: invoice.id, customerId: invoice.customerId, bankAccountId: bank.id, paymentNumber: input.paymentNumber, direction: "receipt", method: input.method, amount: input.amount, paymentDate: new Date(input.paymentDate), status: "posted", createdByUserId: ctx.user.id });
      const paymentId = Number(paymentResult[0].insertId);
      const entryResult = await tx.insert(journalEntries).values({ tenantId: input.tenantId, companyId: input.companyId, fiscalPeriodId: period.id, entryNumber: `JE-${input.paymentNumber}`, entryDate: new Date(input.paymentDate), status: "posted", sourceType: "payment", sourceId: paymentId, description: `تحصيل فاتورة ${invoice.invoiceNumber}`, debitTotal: input.amount, creditTotal: input.amount, createdByUserId: ctx.user.id, postedByUserId: ctx.user.id, postedAt: new Date() });
      const journalEntryId = Number(entryResult[0].insertId);
      await tx.insert(journalLines).values([{ tenantId: input.tenantId, journalEntryId, accountId: bank.accountId, debit: input.amount, credit: "0.000000", description: `تحصيل — ${input.paymentNumber}`, lineOrder: 1 }, { tenantId: input.tenantId, journalEntryId, accountId: receivable.id, customerId: invoice.customerId, debit: "0.000000", credit: input.amount, description: `إقفال ذمة — ${invoice.invoiceNumber}`, lineOrder: 2 }]);
      await tx.update(invoices).set({ paidTotal: newPaidTotal, status: outstanding === "0.000000" ? "paid" : "partially_paid" }).where(eq(invoices.id, invoice.id));
      return { paymentId, journalEntryId, paidTotal: newPaidTotal, outstanding };
    });
  }),

  addBankStatementLine: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), bankAccountId: z.number().int().positive(), transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().max(128).optional(), description: z.string().max(500).optional(), amount: money, direction: z.enum(["inflow", "outflow"]) })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [bank] = await db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(eq(bankAccounts.id, input.bankAccountId), eq(bankAccounts.tenantId, input.tenantId), eq(bankAccounts.companyId, input.companyId))).limit(1);
    if (!bank) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب البنكي غير موجود ضمن الشركة." });
    const result = await db.insert(bankStatementLines).values({ ...input, transactionDate: new Date(input.transactionDate), reconciliationStatus: "unmatched" });
    return { id: Number(result[0].insertId) };
  }),

  reconciliationBoard: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [banks, lines, receiptRows] = await Promise.all([
      db.select().from(bankAccounts).where(and(eq(bankAccounts.tenantId, input.tenantId), eq(bankAccounts.companyId, input.companyId), eq(bankAccounts.isActive, true))),
      db.select().from(bankStatementLines).where(and(eq(bankStatementLines.tenantId, input.tenantId), eq(bankStatementLines.companyId, input.companyId))).orderBy(bankStatementLines.transactionDate),
      db.select({ id: payments.id, paymentNumber: payments.paymentNumber, bankAccountId: payments.bankAccountId, amount: payments.amount, paymentDate: payments.paymentDate, status: payments.status }).from(payments).where(and(eq(payments.tenantId, input.tenantId), eq(payments.companyId, input.companyId), eq(payments.direction, "receipt"), eq(payments.status, "posted"))),
    ]);
    return { banks, lines, receipts: receiptRows };
  }),

  matchBankStatementLine: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), statementLineId: z.number().int().positive(), paymentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const [line] = await db.select().from(bankStatementLines).where(and(eq(bankStatementLines.id, input.statementLineId), eq(bankStatementLines.tenantId, input.tenantId), eq(bankStatementLines.companyId, input.companyId))).limit(1);
    const [payment] = await db.select().from(payments).where(and(eq(payments.id, input.paymentId), eq(payments.tenantId, input.tenantId), eq(payments.companyId, input.companyId), eq(payments.status, "posted"))).limit(1);
    if (!line || !payment || line.reconciliationStatus !== "unmatched") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "سطر الكشف أو التحصيل غير صالح للمطابقة." });
    if (line.direction !== "inflow" || !payment.bankAccountId || payment.bankAccountId !== line.bankAccountId || String(payment.amount) !== String(line.amount)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا تتطابق جهة الحركة أو الحساب البنكي أو المبلغ؛ يلزم مراجعة بشرية." });
    return db.transaction(async (tx) => { await tx.insert(bankReconciliationMatches).values({ tenantId: input.tenantId, companyId: input.companyId, statementLineId: line.id, paymentId: payment.id, matchedAmount: line.amount, matchedByUserId: ctx.user.id }); await tx.update(bankStatementLines).set({ reconciliationStatus: "matched" }).where(eq(bankStatementLines.id, line.id)); return { matched: true }; });
  }),

  trialBalance: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const filters = [eq(journalLines.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId), eq(journalEntries.status, "posted")];
    if (input.startDate) filters.push(gte(journalEntries.entryDate, new Date(`${input.startDate}T00:00:00.000Z`)));
    if (input.endDate) filters.push(lte(journalEntries.entryDate, new Date(`${input.endDate}T23:59:59.999Z`)));
    return db.select({ id: accounts.id, code: accounts.code, nameAr: accounts.nameAr, accountType: accounts.accountType, debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`, credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)` }).from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id)).innerJoin(accounts, eq(journalLines.accountId, accounts.id)).where(and(...filters)).groupBy(accounts.id, accounts.code, accounts.nameAr, accounts.accountType);
  }),

  ledger: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), companyId: z.number().int().positive(), accountId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const db = await accessCompany(ctx.user.id, input.tenantId, input.companyId);
    const filters = [eq(journalLines.tenantId, input.tenantId), eq(journalEntries.companyId, input.companyId), eq(journalEntries.status, "posted")];
    if (input.accountId) filters.push(eq(journalLines.accountId, input.accountId));
    return db.select({ entryNumber: journalEntries.entryNumber, entryDate: journalEntries.entryDate, description: journalLines.description, debit: journalLines.debit, credit: journalLines.credit, accountCode: accounts.code, accountName: accounts.nameAr }).from(journalLines).innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id)).innerJoin(accounts, eq(journalLines.accountId, accounts.id)).where(and(...filters)).orderBy(journalEntries.entryDate);
  }),
});
