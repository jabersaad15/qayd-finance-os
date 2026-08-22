# Database ERD and Integrity Model

## 1. سياسة البيانات

جميع المبالغ `decimal(18,6)` ولا تستخدم الأعداد العائمة. تحفظ التواريخ التشغيلية بتوقيت UTC مع حقول تاريخ محاسبية عند الحاجة. يكون رقم المستند بشرياً ومقيداً بفهرس فريد، لكن المعرف الأساسي الداخلي مستقل وغير قابل لإعادة الاستخدام. كل تغيير مالي أو صلاحية حساسة يولّد سجل تدقيق مضافاً فقط.

```mermaid
erDiagram
  TENANTS ||--o{ COMPANIES : owns
  TENANTS ||--o{ TENANT_USERS : contains
  USERS ||--o{ TENANT_USERS : joins
  COMPANIES ||--o{ BRANCHES : has
  COMPANIES ||--o{ FISCAL_PERIODS : governs
  COMPANIES ||--o{ ACCOUNTS : defines
  COMPANIES ||--o{ CUSTOMERS : serves
  COMPANIES ||--o{ SUPPLIERS : buys_from
  COMPANIES ||--o{ PRODUCTS_SERVICES : sells
  CUSTOMERS ||--o{ QUOTATIONS : receives
  QUOTATIONS ||--o{ QUOTATION_LINES : includes
  QUOTATIONS ||--o{ INVOICES : converts_to
  INVOICES ||--o{ INVOICE_LINES : includes
  INVOICES ||--o{ PAYMENTS : settles
  INVOICES ||--o{ COMPLIANCE_CHECKS : validated_by
  FISCAL_PERIODS ||--o{ JOURNAL_ENTRIES : contains
  JOURNAL_ENTRIES ||--|{ JOURNAL_LINES : balances
  ACCOUNTS ||--o{ JOURNAL_LINES : posted_to
  JOURNAL_ENTRIES ||--o{ AUDIT_LOGS : records
  COMPANIES ||--o{ DOCUMENTS : stores
  DOCUMENTS ||--o{ DOCUMENT_LINKS : attaches
  COMPANIES ||--o{ APPROVAL_POLICIES : configures
  APPROVAL_POLICIES ||--o{ APPROVAL_REQUESTS : produces
  TENANTS ||--o{ COMPLIANCE_RULESETS : versions
```

## 2. الجداول المحورية

| المجال | الجداول الأساسية | قيود السلامة |
| --- | --- | --- |
| العزل | `tenants`, `companies`, `tenantUsers` | فريد: عضوية المستخدم ضمن المستأجر؛ كل كيان أعمالي يحمل `tenantId` |
| الوصول | `roles`, `permissions`, `rolePermissions`, `userRoleAssignments`, `approvalPolicies` | لا تمنح الواجهة صلاحية؛ القرار في الخادم مع سياق المستأجر |
| التهيئة | `branches`, `fiscalPeriods`, `costCenters`, `projects`, `numberingSequences`, `taxProfiles` | لا قيد خارج فترة مفتوحة؛ رقم مستند فريد ضمن نطاق التسلسل |
| المبيعات | `customers`, `productsServices`, `quotations`, `quotationLines`, `invoices`, `invoiceLines`, `payments` | لا إصدار دون عميل وخطوط موجبة ونتائج تحقق صالحة |
| المحاسبة | `accounts`, `journalEntries`, `journalLines`, `postingRules`, `accountingEvents` | مدين = دائن لكل قيد مرحّل؛ القيد المرحّل immutable |
| الامتثال | `complianceRulesets`, `complianceRules`, `complianceChecks`, `zatcaSubmissions` | كل فحص يربط بإصدار قاعدة ومخرجات قابلة للتدقيق |
| المستندات | `documents`, `documentLinks`, `documentClassifications` | لا تخزن ملفات في قاعدة البيانات؛ تحفظ مراجع تخزين فقط |
| التدقيق | `auditLogs`, `outboxEvents`, `idempotencyKeys` | سجل append-only، مفاتيح تكرار فريدة، أثر كامل للمحاولة |

## 3. نموذج القيد

`journalEntries` يمثل رأس القيد: الشركة، الفرع، الفترة، الحالة، التاريخ، المرجع، مصدر الحدث، القيد الأصلي إن كان عكساً، ومجموعي المدين والدائن. يمثل `journalLines` السطور: الحساب، مبلغ مدين أو دائن حصراً، مركز تكلفة، مشروع، عميل أو مورد، وصف، وتسلسل. يفرض التطبيق ومحفز الخدمة أن يكون مجموع المدين والدائن متساويين قبل تغيير الحالة إلى `posted`.

## 4. فهرسة وقيود

تُفهرس جميع جداول القراءة التشغيلية بـ`tenantId` ثم المفاتيح الشائعة مثل `status` و`issuedAt` و`customerId`. تُبنى فهارس مساندة على `(tenantId, fiscalPeriodId, status)` للقيود وعلى `(tenantId, documentType, documentNumber)` للمستندات. تفرض مفاتيح خارجية بين الرؤوس والسطور، وتعزل البيانات المرجعية المحذوفة من الإلغاء الفعلي إذا ارتبطت بسجل مالي.

