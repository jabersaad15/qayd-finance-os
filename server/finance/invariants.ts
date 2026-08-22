export type Money = string;

export type InvoiceCalculationLine = {
  quantity: Money;
  unitPrice: Money;
  discountAmount: Money;
  taxRateBps: number;
};

export type JournalValidationLine = {
  debit: Money;
  credit: Money;
};

const SCALE = 1_000_000n;

function parseMoney(value: Money): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("صيغة المبلغ غير صحيحة؛ يلزم عدد عشري حتى ست منازل.");
  }
  const negative = value.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = (negative ? value.slice(1) : value).split(".");
  const whole = BigInt(wholeRaw);
  const fraction = BigInt(fractionRaw.padEnd(6, "0"));
  const result = whole * SCALE + fraction;
  return negative ? -result : result;
}

function toMoney(value: bigint): Money {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function multiplyScaled(left: bigint, right: bigint): bigint {
  const product = left * right;
  const rounded = product >= 0n ? product + SCALE / 2n : product - SCALE / 2n;
  return rounded / SCALE;
}

export function calculateInvoiceTotals(lines: InvoiceCalculationLine[]) {
  if (lines.length === 0) throw new Error("لا يمكن حساب فاتورة بلا بنود.");

  let subtotal = 0n;
  let discountTotal = 0n;
  let taxTotal = 0n;

  for (const line of lines) {
    const quantity = parseMoney(line.quantity);
    const unitPrice = parseMoney(line.unitPrice);
    const discount = parseMoney(line.discountAmount);
    if (quantity <= 0n || unitPrice < 0n || discount < 0n || line.taxRateBps < 0) {
      throw new Error("قيم بنود الفاتورة يجب أن تكون موجبة، ولا تقبل ضريبة سالبة.");
    }

    const gross = multiplyScaled(quantity, unitPrice);
    if (discount > gross) throw new Error("لا يمكن أن يتجاوز الخصم قيمة البند.");
    const taxable = gross - discount;
    const tax = (taxable * BigInt(line.taxRateBps) + 5_000n) / 10_000n;

    subtotal += gross;
    discountTotal += discount;
    taxTotal += tax;
  }

  const taxableTotal = subtotal - discountTotal;
  return {
    subtotal: toMoney(subtotal),
    discountTotal: toMoney(discountTotal),
    taxableTotal: toMoney(taxableTotal),
    taxTotal: toMoney(taxTotal),
    grandTotal: toMoney(taxableTotal + taxTotal),
  };
}

export function addMoney(values: Money[]): Money {
  return toMoney(values.reduce((total, value) => total + parseMoney(value), 0n));
}

export function subtractMoney(left: Money, right: Money): Money {
  return toMoney(parseMoney(left) - parseMoney(right));
}

export function validateJournalEntry(lines: JournalValidationLine[]) {
  if (lines.length < 2) {
    return { valid: false, debitTotal: "0.000000", creditTotal: "0.000000", message: "يتطلب القيد سطرين على الأقل." };
  }

  let debitTotal = 0n;
  let creditTotal = 0n;
  for (const line of lines) {
    const debit = parseMoney(line.debit);
    const credit = parseMoney(line.credit);
    if (debit < 0n || credit < 0n || (debit > 0n && credit > 0n)) {
      return { valid: false, debitTotal: toMoney(debitTotal), creditTotal: toMoney(creditTotal), message: "كل سطر يجب أن يكون مديناً أو دائناً فقط وبقيمة غير سالبة." };
    }
    debitTotal += debit;
    creditTotal += credit;
  }

  if (debitTotal === 0n || debitTotal !== creditTotal) {
    return { valid: false, debitTotal: toMoney(debitTotal), creditTotal: toMoney(creditTotal), message: "لا يمكن ترحيل قيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن." };
  }
  return { valid: true, debitTotal: toMoney(debitTotal), creditTotal: toMoney(creditTotal), message: "القيد متوازن وقابل للتقديم للاعتماد." };
}

export function preIssueStructuralCheck(input: {
  sellerTaxNumber?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  lines: InvoiceCalculationLine[];
}) {
  const issues: Array<{ code: string; severity: "critical" | "warning"; message: string }> = [];
  if (!input.invoiceNumber?.trim()) issues.push({ code: "invoice.number.missing", severity: "critical", message: "رقم الفاتورة مطلوب قبل الإصدار." });
  if (!input.invoiceType) issues.push({ code: "invoice.type.missing", severity: "critical", message: "نوع الفاتورة مطلوب قبل الإصدار." });
  if (!input.sellerTaxNumber?.trim()) issues.push({ code: "seller.tax_number.missing", severity: "critical", message: "الرقم الضريبي للبائع مطلوب في هذا الفحص البنيوي." });
  if (input.lines.length === 0) issues.push({ code: "invoice.lines.missing", severity: "critical", message: "لا يمكن إصدار فاتورة بلا بنود." });

  try {
    calculateInvoiceTotals(input.lines);
  } catch (error) {
    issues.push({ code: "invoice.totals.invalid", severity: "critical", message: error instanceof Error ? error.message : "تعذر التحقق من المجاميع." });
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  return {
    score: Math.max(0, 100 - criticalCount * 25),
    canIssue: criticalCount === 0,
    issues,
    notice: "هذا فحص بنيوي داخلي؛ لا يثبت اعتماداً أو امتثالاً رسمياً لهيئة الزكاة والضريبة والجمارك.",
  };
}
