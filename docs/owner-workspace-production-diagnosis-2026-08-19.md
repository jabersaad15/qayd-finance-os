# تشخيص فشل مساحة العمل — 2026-08-19

## النتيجة
من جلسة المتصفح على https://qayd.tech/ كان الحساب الظاهر `finance-manager.test@qayd.tech`، والدور في قاعدة الإنتاج `finance_manager`. العضوية كانت مرتبطة فعليًا بـ tenant 1 وcompany 1، واسم الشركة `Consedra Holding` / `شركة كونسيدرا القابضة`، والحالة active.

## الخطأ الفعلي
الطلب المباشر إلى:

`https://qayd.tech/api/trpc/finance.listMyWorkspaces?batch=1&input=...`

أعاد HTTP 500 برسالة استعلام Drizzle يطلب العمود `appRoles.isActive`. واجهة Workspace عرضت «مساحة العمل غير متاحة» بعد إضافة حالة الخطأ الصريحة.

## فحص قاعدة الإنتاج
جدول `appRoles` كان يفتقد العمود `isActive`، وكان يحتوي 9 أدوار. هذا يفسر فشل listMyWorkspaces رغم وجود العضوية والشركة.

## الإجراء المنفذ
أُخذت نسخة احتياطية لجدولي `appRoles` و`tenantUsers` في:

`/root/qayd-backups/20260819T190923Z-membership-schema-fix/membership-tables.sql.gz`

ثم طُبق migration غير هدّام:

`ALTER TABLE appRoles ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT TRUE;`

## التحقق
بعد migration أعاد طلب listMyWorkspaces HTTP 200، وأظهر العضوية `finance_manager`، tenant `Consedra Holding`، والشركة `شركة كونسيدرا القابضة`، وكلها active. بقيت الصفحة المفتوحة في المتصفح على حالة الخطأ القديمة حتى إعادة تحميل/إعادة جلب الاستعلام.
