# تقرير السبب الجذري — Compliance CSID في ZATCA Simulation

## نطاق التنفيذ

تم التنفيذ من حاوية التطبيق الفعلية `hostinger-app-1` على VPS الخارجي فقط. لم تُستخدم بيئة المعاينة في إرسال الطلب، ولم تُنفذ أي محاولة OTP إضافية بعد النتيجة أدناه.

| بند الفحص | النتيجة | الدليل المختصر |
|---|---|---|
| Environment | PASS | `simulation` |
| Endpoint | PASS | `https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation/compliance` |
| DNS / Network | PASS | حلّ الاسم إلى عنوان IPv4 وخروج HTTPS دون proxy |
| TLS | PASS | اتصال موثوق إلى `zatca.gov.sa` |
| CSR Parse / Signature | PASS | OpenSSL: `Certificate request self-signature verify OK` |
| CSR Fields / OIDs / UTF-8 | PASS | `PREZATCA-Code-Signing`، `secp256k1`، وترميز عربي صحيح بعد الإصلاح |
| Headers / Payload | PASS | POST + JSON + `Accept-Version: V2` + CSR بتشفير Base64 أحادي |
| Credentials State | PASS | لا توجد اعتمادات نشطة أو جزئية للوحدة المستهدفة قبل الطلب |

## سجل الطلب الآمن

| حقل | القيمة |
|---|---|
| Environment | `simulation` |
| HTTP Method | `POST` |
| Content-Type | `application/json` |
| Accept-Version | `V2` |
| OTP Present | `YES` — لم تُسجل قيمته |
| CSR SHA-256 | `1b599861ffb9515f59eed9a43c4f6d45e683d08c01c5ec6cbb1bf386654844ef` |
| CSR Length | `886` bytes |

## استجابة ZATCA الفعلية

```text
HTTP STATUS: 400
ZATCA ERROR CODE: Invalid-OTP
ZATCA MESSAGE: The provided OTP is invalid
REQUEST ID: 504d9e0a-4ee2-4c2c-a68c-5d1200c33759
CORRELATION ID: غير موجود في الاستجابة
TIMESTAMP: 2026-08-20T13:28:48.714Z
```

جسم الاستجابة المنقح:

```json
{"errors":[{"code":"Invalid-OTP","message":"The provided OTP is invalid"}]}
```

## السبب الجذري والنتيجة

**السبب الجذري المؤكد لهذه المحاولة هو رفض ZATCA للـOTP نفسه**، وليس مسار الشبكة أو TLS أو endpoint أو بنية CSR أو ترميزها أو الـheaders أو التخزين. لم يصدر Compliance CSID، ولم يُحفظ `Secret` أو شهادة أو اعتماد جزئي؛ بقيت وحدة `QAYD-EGS-SIM-001` في `csrStatus=issued` و`complianceCsidStatus=failed`، وعدد الاعتمادات للوحدة هو صفر.

توقف التنفيذ بعد هذه المحاولة التزاماً بالشرط التشغيلي. لا يجوز استخدام رمز آخر قبل قرار المستخدم.
