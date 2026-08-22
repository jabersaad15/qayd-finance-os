# ملاحظات بحث تكامل ZATCA — 2026-08-19

## مصادر رسمية تمت مراجعتها

1. [ZATCA Developer Portal Manual](https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/DEVELOPER-PORTAL-MANUAL.pdf) — نتيجة البحث الرسمية تشير إلى أن Compliance CSID هو CSID مرحلي يُعاد عند إرسال CSR من EGS أو حل الفوترة، لكن استخراج نص PDF عبر الويب كان جزئياً/مشفرًا، لذلك يلزم تنزيله وتحليله محلياً قبل تثبيت الحقول والمسارات.
2. [ZATCA E-Invoicing](https://zatca.gov.sa/en/E-Invoicing/Pages/default.aspx) — الصفحة الرسمية تؤكد أن متطلبات الفوترة الإلكترونية منشورة من الهيئة.
3. [ZATCA Roll-out phases](https://zatca.gov.sa/en/E-Invoicing/Introduction/Pages/Roll-out-phases.aspx) — المرحلة الثانية هي Integration phase، وتشمل المتطلبات التقنية والتجارية والتكامل مع أنظمة ZATCA، وتُطرح على موجات للمكلفين.

## قرارات قبل التنفيذ

لن يتم تثبيت endpoint أو header أو صيغة CSR من مقتطفات غير مكتملة أو أمثلة قديمة. يجب تنزيل دليل المطور/SDK أو الوصول إلى Developer Portal وSwagger الرسمي، والتحقق من بيئة المحاكاة والمسارات الحالية قبل كتابة عميل HTTP. ستُعامل OTP والمفاتيح الخاصة وCSID secrets كأسرار مؤقتة/مشفرة، ولن تُحفظ في المصدر أو السجل أو الواجهة أو الاستجابات.

## حالة المشروع

المشروع الحالي هو QAYD المبني على React 19 وtRPC 11 وDrizzle/MariaDB، ويحتوي على محرك فواتير وتوليد XML/QR ونقاط امتداد ZATCA قابلة للإصدار. الخطوة التالية هي فحص الملفات الحالية والجداول والروترات قبل إضافة أي نموذج أو ترحيل، ثم مطابقة التصميم مع التوثيق الرسمي الكامل.

## نتائج المتصفح من بوابة ZATCA الرسمية

صفحة [Systems Developers](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/default.aspx) تعرض رابطين رسميين مهمين: [Technical requirements & specifications](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/TechnicalRequirementsSpec.aspx) و[E-Invoicing Developer Portal](https://sandbox.zatca.gov.sa/). صفحة المتطلبات التقنية تعرض رابط [E-Invoice specifications](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/E-Invoice-specifications.aspx) ورابط [Security requirements](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/Security-Requirements.aspx). هذه الروابط ستكون مصدر تثبيت XML/QR والأمن قبل اعتماد أي endpoint أو header داخل الكود.

## مواصفات XML الرسمية

صفحة [E-Invoice specifications](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/E-Invoice-specifications.aspx) تشير إلى [Electronic Invoice Data Dictionary vF بتاريخ 19 May 2023](https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_EInvoice_Data_Dictionary%20vF.xlsx) وإلى [Electronic Invoice XML Implementation Standard vF بتاريخ 19 May 2023](https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_XML_Implementation_Standard_%20vF.pdf). ستُستخدم هذه الملفات للتحقق من XML والتوقيع والبيانات، وليس الاعتماد على تخمينات من مصادر غير رسمية.

## الأمن

صفحة [Security requirements](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/Security-Requirements.aspx) تشير إلى [Security Features Implementation Standards vF بتاريخ 19 May 2023](https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20230519_ZATCA_Electronic_Invoice_Security_Features_Implementation_Standards_vF.pdf). لذلك يستمر التصميم في تشفير المفتاح الخاص وCSID secrets وعدم إخراج OTP أو الاعتمادات في logs أو API responses.

## SDK الرسمي

صفحة [Download SDK](https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/ComplianceEnablementToolbox/Pages/DownloadSDK.aspx) توضح أن Compliance and Enablement Toolbox SDK يساعد المطورين على التحقق من توافق الفواتير والإشعارات الدائنة والمدينة، وتؤكد أن اجتياز SDK لا يعني اعتماد الفاتورة من ZATCA. لذلك لا يجوز تصنيف الاختبارات المحلية أو نجاح SDK على أنه اتصال رسمي مكتمل.
