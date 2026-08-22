export type AccountantDateRange = { startDate?: string; endDate?: string };

type DatedRecord = { createdAt?: string | Date | null; updatedAt?: string | Date | null; checkedAt?: string | Date | null; invoiceDate?: string | Date | null; status?: string; hasCriticalErrors?: boolean };

export type AccountantDashboardSnapshot = {
  purchases?: Array<{ invoice: { status: string; invoiceDate?: string | Date | null; createdAt?: string | Date | null } }> | null;
  compliance?: {
    submissions?: DatedRecord[] | null;
    checks?: DatedRecord[] | null;
    reviewCount?: number | null;
    queuedCount?: number | null;
  } | null;
  vat?: {
    periods?: Array<{ period?: { startDate?: string | Date | null; endDate?: string | Date | null } }> | null;
    zakatDocuments?: DatedRecord[] | null;
    preparations?: Array<{ status: string; updatedAt?: string | Date | null }> | null;
  } | null;
  balance?: Array<{ debit: string | number; credit: string | number }> | null;
};

function asTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function validateAccountantDateRange(range: AccountantDateRange) {
  if (range.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(range.startDate)) return "صيغة تاريخ البداية غير صحيحة.";
  if (range.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate)) return "صيغة تاريخ النهاية غير صحيحة.";
  if (range.startDate && range.endDate && range.startDate > range.endDate) return "يجب أن يسبق تاريخ البداية تاريخ النهاية.";
  return null;
}

function isInRange(value: string | Date | null | undefined, range: AccountantDateRange) {
  const time = asTime(value);
  if (time === null) return true;
  const start = range.startDate ? asTime(`${range.startDate}T00:00:00.000Z`) : null;
  const end = range.endDate ? asTime(`${range.endDate}T23:59:59.999Z`) : null;
  return (start === null || time >= start) && (end === null || time <= end);
}

function overlapsPeriod(period: { startDate?: string | Date | null; endDate?: string | Date | null } | undefined, range: AccountantDateRange) {
  if (!period) return true;
  const periodStart = asTime(period.startDate);
  const periodEnd = asTime(period.endDate);
  const start = range.startDate ? asTime(`${range.startDate}T00:00:00.000Z`) : null;
  const end = range.endDate ? asTime(`${range.endDate}T23:59:59.999Z`) : null;
  return (end === null || periodStart === null || periodStart <= end) && (start === null || periodEnd === null || periodEnd >= start);
}

export function filterAccountantDashboardSnapshot(snapshot: AccountantDashboardSnapshot, range: AccountantDateRange): AccountantDashboardSnapshot {
  if (validateAccountantDateRange(range)) return snapshot;
  const purchases = (snapshot.purchases ?? []).filter(({ invoice }) => isInRange(invoice.invoiceDate ?? invoice.createdAt, range));
  const compliance = snapshot.compliance ?? {};
  const submissions = (compliance.submissions ?? []).filter((item) => isInRange(item.createdAt, range));
  const checks = (compliance.checks ?? []).filter((item) => isInRange(item.checkedAt ?? item.createdAt, range));
  const vat = snapshot.vat ?? {};
  const periods = (vat.periods ?? []).filter((item) => overlapsPeriod(item.period, range));
  const preparations = (vat.preparations ?? []).filter((item) => isInRange(item.updatedAt, range));
  const zakatDocuments = (vat.zakatDocuments ?? []).filter((item) => isInRange(item.createdAt ?? item.updatedAt, range));
  return { purchases, compliance: { submissions, checks, queuedCount: submissions.filter((item) => item.status === "queued").length, reviewCount: checks.filter((item) => item.hasCriticalErrors).length }, vat: { periods, preparations, zakatDocuments }, balance: snapshot.balance };
}

export function deriveAccountantDashboardState(snapshot: AccountantDashboardSnapshot) {
  const purchases = snapshot.purchases ?? [];
  const compliance = snapshot.compliance ?? {};
  const vat = snapshot.vat ?? {};
  const balance = snapshot.balance ?? [];
  const debit = balance.reduce((sum, row) => sum + Number(row.debit), 0);
  const credit = balance.reduce((sum, row) => sum + Number(row.credit), 0);
  const pendingSupplier = purchases.filter(({ invoice }) => invoice.status === "pending_review").length;
  const draftSupplier = purchases.filter(({ invoice }) => invoice.status === "draft").length;
  const preparedVat = (vat.preparations ?? []).filter((item) => item.status === "under_review").length;
  const reviewedVat = (vat.preparations ?? []).filter((item) => item.status === "reviewed").length;
  const hasOperationalData = Boolean(purchases.length || compliance.submissions?.length || compliance.checks?.length || vat.periods?.length || vat.zakatDocuments?.length || balance.length);
  const reviewCount = compliance.reviewCount ?? 0;
  return { hasOperationalData, pendingSupplier, draftSupplier, preparedVat, reviewedVat, queuedCompliance: compliance.queuedCount ?? 0, reviewCount, debit, credit, balanced: Math.abs(debit - credit) < 0.000001 };
}
