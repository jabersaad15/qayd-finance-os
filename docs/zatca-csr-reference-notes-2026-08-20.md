# ملاحظات مرجعية: CSR في ZATCA Simulation

## المصدر والملاحظة

توضح صفحة Microsoft الخاصة بتهيئة الفوترة الإلكترونية في السعودية أن OTP صالح لمدة ساعة، وأن مرحلة الربط تمنح Compliance CSID أولاً ثم Production CSID بعد فحوص الامتثال. كما تعرض قالب OpenSSL ذا أقسام `oid_section` و`[OIDs]` و`[req_ext]`، وتذكر أن Simulation يتطلب `CN=PREZATCA-Code-Signing` و`certificateTemplateName=ASN1:PRINTABLESTRING:PREZATCA-Code-Signing`.

المصدر: <https://learn.microsoft.com/en-us/dynamics365/finance/localizations/mea/gs-e-invoicing-sa-onboarding>

وتؤكد مناقشة مجتمع مطوري FATOORA أن Simulation وProduction بيئتان مستقلتان، وأن CSR المخصص للمحاكاة ينبغي أن يستخدم قالب PREZATCA وأن يكون OTP صادراً من بوابة Simulation.

المصدر: <https://zatca1.discourse.group/t/simulation-environment-handling-csr-and-compliance-api-with-zatca/4157>

## أثر التطبيق

اعتمد QAYD الأقسام المرجعية `oid_section` و`req_ext` مع OID `1.3.6.1.4.1.311.20.2`، ويمرر البريد الرسمي للشركة داخل CSR. يجب عدم استهلاك OTP جديد ما لم تكن بيئة FATOORA المختارة هي Simulation وتكون بيانات VAT والتسجيل مطابقة لبيانات الشركة المستخدمة في CSR.
