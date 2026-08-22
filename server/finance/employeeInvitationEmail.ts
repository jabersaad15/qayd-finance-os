import nodemailer from "nodemailer";
import { LEGAL_POLICY_PATHS, PRODUCT_BRAND } from "../../shared/productBrand";

export type EmployeeInvitationEmailInput = { to: string; displayName?: string; username: string; temporaryPassword: string; roleName: string; companyName?: string; publicAppUrl?: string };

export function buildEmployeeInvitationEmail(input: EmployeeInvitationEmailInput) {
  const companyName = input.companyName || PRODUCT_BRAND.bilingual;
  const loginUrl = input.publicAppUrl || PRODUCT_BRAND.defaultLoginUrl;
  const publicAppUrl = (input.publicAppUrl || PRODUCT_BRAND.defaultLoginUrl).replace(/\/login\/?$/, "");
  const termsUrl = `${publicAppUrl}${LEGAL_POLICY_PATHS.terms}`;
  const privacyUrl = `${publicAppUrl}${LEGAL_POLICY_PATHS.privacy}`;
  const subject = `دعوة دخول إلى ${companyName}`;
  const recipient = input.displayName || "الزميل/الزميلة";
  const text = `مرحباً ${recipient}،\n\nتم إنشاء حساب لك في منصة ${PRODUCT_BRAND.bilingual} لإدارة مساحة شركتك. اسم الشركة: ${companyName}.\n\nاسم المستخدم: ${input.username}\nكلمة المرور المؤقتة: ${input.temporaryPassword}\nالدور: ${input.roleName}\nرابط الدخول: ${loginUrl}\n\nلأسباب أمنية، يجب تغيير كلمة المرور بعد أول دخول، ولا تشارك هذه الرسالة مع أي شخص. يتطلب تفعيل الدعوة الموافقة على الشروط والأحكام وسياسة الخصوصية الحالية: ${termsUrl} — ${privacyUrl}\n\nمع التحية،\n${companyName}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#24352f"><h2 style="color:#0b3d3a">دعوة الدخول إلى ${companyName}</h2><p>مرحباً <strong>${recipient}</strong>،</p><p>تم إنشاء حساب لك في منصة ${PRODUCT_BRAND.bilingual} لإدارة مساحة شركتك. اسم الشركة: ${companyName}.</p><table dir="rtl" style="border-collapse:collapse;width:100%;max-width:520px"><tr><td style="padding:8px;border:1px solid #dce8df">اسم المستخدم</td><td dir="ltr" style="padding:8px;border:1px solid #dce8df"><strong>${input.username}</strong></td></tr><tr><td style="padding:8px;border:1px solid #dce8df">كلمة المرور المؤقتة</td><td dir="ltr" style="padding:8px;border:1px solid #dce8df"><strong>${input.temporaryPassword}</strong></td></tr><tr><td style="padding:8px;border:1px solid #dce8df">الدور</td><td style="padding:8px;border:1px solid #dce8df">${input.roleName}</td></tr></table><p><a href="${loginUrl}" style="display:inline-block;background:#0b3d3a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px">فتح منصة ${PRODUCT_BRAND.bilingual}</a></p><p style="color:#8a594f"><strong>تنبيه أمني:</strong> يجب تغيير كلمة المرور بعد أول دخول، ولا تشارك هذه الرسالة. يتطلب تفعيل الدعوة الموافقة على <a href="${termsUrl}">الشروط والأحكام</a> و<a href="${privacyUrl}">سياسة الخصوصية</a> الحالية.</p><p>مع التحية،<br/>${companyName}</p></div>`;
  return { subject, text, html };
}

export async function sendEmployeeInvitationEmail(input: EmployeeInvitationEmailInput) {
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const message = buildEmployeeInvitationEmail(input);
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: input.to, subject: message.subject, text: message.text, html: message.html });
  transporter.close();
  return { messageId: info.messageId, subject: message.subject };
}
