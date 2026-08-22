# تشخيص رفض Compliance CSID الأخير

التاريخ: 2026-08-19.

## النتيجة

تمت مطابقة محاولة الربط الأخيرة مع قاعدة إنتاج VPS. وحدة EGS ذات الرقم التسلسلي `121541` هي الأحدث، وحالتها `csrStatus=issued`، بينما `complianceCsidStatus=failed` و`connectionStatus=failed`. الوحدة الأقدم `531873` تحمل الحالة نفسها من محاولة سابقة.

سجل التطبيق بعد نشر تحسين استخراج الأخطاء يحتوي ثلاث محاولات بصيغة:

`[ZATCA] Compliance CSID rejected { status: 400, reason: '400' }`

هذا يثبت أن الطلب يصل إلى Gateway ويرجع HTTP 400، لكن جسم الاستجابة الذي يصل للتطبيق ليس رسالة قابلة للاستخراج؛ لا يوجد في السجل سبب رسمي مثل invalid CSR أو invalid OTP. لم يتم تسجيل OTP أو أي secret.

## ما تم التحقق منه

OpenSSL موجود في صورة الإنتاج، وتوليد CSR ينجح ويُحفظ المفتاح الخاص مشفرًا. جداول `zatcaEgsUnits` و`zatcaCredentials` موجودة في قاعدة الإنتاج. تم تحسين Gateway لاستخراج رسائل JSON المتداخلة وتنقية الأسرار، لكن بوابة ZATCA الحالية تعيد قيمة عامة `400` فقط.

## الإجراء التالي

يجب عدم إعادة استخدام OTP السابق. يلزم الحصول على رمز FATOORA Simulation جديد، وإعادة المحاولة بعد اختيار الوحدة `121541` وتوليد CSR لها. إذا استمر HTTP 400، يلزم مقارنة جسم الطلب الفعلي مع وثائق ZATCA/API version وبيانات CSR/الرقم الضريبي، مع إبقاء OTP خارج السجلات.

## المصدر الخارجي

الدليل الرسمي الذي تم تنزيله للتحقق من متطلبات Compliance CSID وCSR:

https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/DEVELOPER-PORTAL-MANUAL.pdf

توضح الصفحات 26–27 أن Compliance CSID في Simulation يتطلب OTP صالحًا وCSR في جسم الطلب مع استخدام إصدار API V2.
