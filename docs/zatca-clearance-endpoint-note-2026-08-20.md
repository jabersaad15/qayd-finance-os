# ملاحظة تشغيلية: Simulation Clearance Endpoint

الرابط التالي هو endpoint **تصفية فاتورة واحدة** في بيئة ZATCA Simulation:

```text
https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/invoices/clearance/single
```

لا يُستخدم الرابط لإصدار Compliance CSID ولا يقبل OTP. ترتيب التشغيل الصحيح هو: إصدار Compliance CSID من `/simulation/compliance` باستخدام OTP، ثم تنفيذ اختبارات الامتثال عبر `/simulation/compliance/invoices`، ثم إصدار Production CSID للمحاكاة من `/simulation/production/csids`. بعد وجود Production CSID فعّال فقط، تستخدم QAYD endpoint التصفية أو الإبلاغ لإرسال فواتير موقعة.

يتطلب Endpoint التصفية مصادقة Basic مبنية من `binarySecurityToken:secret` الخاصة بـProduction CSID، مع XML فاتورة موقّعة وUUID وinvoice hash. لذلك لا يمكن ولا ينبغي الاتصال به حالياً: لا توجد بيانات اعتماد محلية فعّالة محفوظة بعد محاولة onboarding، ولا يجب إرسال فواتير اختبارية أو تشغيلية قبل استرداد/إعادة إصدار الاعتماد واستكمال اختبارات الامتثال.

## المراجع

[1] [FATOORA Developer Community — Current Simulation and Production endpoints](https://zatca1.discourse.group/t/whats-the-difference-what-is-the-next-step/4344)

[2] [FATOORA Developer Community — CSID and compliance-check sequence](https://zatca1.discourse.group/t/401-unauthorized-in-reporting-api/2502)
