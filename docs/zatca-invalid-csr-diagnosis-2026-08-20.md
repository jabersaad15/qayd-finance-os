# تشخيص Invalid-CSR في ZATCA Simulation

## النتيجة العملية

أظهر فحص غير مستهلك لرمز OTP على بيئة الإنتاج أن بوابة ZATCA تصل إلى مسار Simulation لكنها تعيد `Invalid-CSR` للطلب الحالي. لا يجوز استهلاك رموز FATOORA الصالحة إلى أن يتحول الفحص التجريبي إلى `Invalid-OTP`؛ فهذا التحول يعني أن البوابة قبلت CSR ووصلت إلى تحقق الرمز.

## مواصفة القالب المطلوب

يجب استخدام أقسام OpenSSL الرسمية: `oid_section` لتعريف `certificateTemplateName` بالـ OID `1.3.6.1.4.1.311.20.2`، ثم قسم `req_ext` الذي يضع `certificateTemplateName = ASN1:PRINTABLESTRING:PREZATCA-Code-Signing`، مع `basicConstraints = CA:FALSE` و`keyUsage = digitalSignature, nonRepudiation, keyEncipherment` و`subjectAltName = dirName:alt_names`. يجب أيضاً توليد المفتاح على منحنى `secp256k1`، وتحويل CSR كاملاً إلى Base64 في جسم طلب Compliance، واستخدام مسار Simulation الحديث.

## ملاحظة الترميز

أظهر فحص OpenSSL السابق اسم الشركة العربية بصيغة بايتات مزدوجة الترميز في Subject؛ لذلك يلزم فرض UTF-8 في إعداد `req` وتمرير خيار `-utf8` عند إنشاء CSR، ثم التحقق من Subject باستخدام `-nameopt utf8`.

## مقارنة قالب مرجعي

أظهر مولد CSR المفتوح المصدر في مكتبة Salla أن قالب Simulation يعمل عبر `req_extensions = v3_req` وقسم امتدادات باسم `v3_req` يحتوي OID `1.3.6.1.4.1.311.20.2` مباشرةً بقيمة `ASN1:PRINTABLESTRING:PREZATCA-Code-Signing`، و`subjectAltName = dirName:subject`. يجب اختبار هذا الترتيب نفسه مقابل الرد التجريبي؛ الغرض من المقارنة هو عزل اختلاف ترتيب أقسام OpenSSL، لا نسخ بيانات منشأة مرجعية أو الاعتماد على المكتبة كبديل للمواصفة الرسمية.

## المراجع

1. [FATOORA Developer Community — Invalid CSR for simulation](https://zatca1.discourse.group/t/invalid-csr-for-simulation/6098)
2. [FATOORA Developer Community — The provided CSR is invalid](https://zatca1.discourse.group/t/error-message-the-provided-certificate-signing-request-csr-is-invalid/7570)
3. [FATOORA Developer Community — Simulation environment handling](https://zatca1.discourse.group/t/simulation-environment-handling-csr-and-compliance-api-with-zatca/4157)
4. [SallaApp/ZATCA — GenerateCSR.php](https://github.com/SallaApp/ZATCA/blob/master/src/GenerateCSR.php)
