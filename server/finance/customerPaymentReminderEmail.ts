import nodemailer from "nodemailer";
import { PRODUCT_BRAND } from "../../shared/productBrand";

export type PaymentReminderEmailInput = { to: string; customerName: string; invoiceNumber: string; outstanding: string; dueDate: string; companyName?: string; publicAppUrl?: string };

export function buildPaymentReminderEmail(input: PaymentReminderEmailInput) {
  const companyName = input.companyName || PRODUCT_BRAND.bilingual;
  const subject = `تذكير بسداد الفاتورة ${input.invoiceNumber} — ${companyName}`;
  const text = `السادة ${input.customerName}،\n\nنود تذكيركم بأن الفاتورة رقم ${input.invoiceNumber} ما زال عليها رصيد مستحق قدره ${Number(input.outstanding).toFixed(2)} SAR، وكان تاريخ الاستحقاق ${input.dueDate}.\n\nيرجى التواصل معنا لتأكيد موعد السداد.${input.publicAppUrl ? `\n\nبوابة المتابعة: ${input.publicAppUrl}` : ""}\n\nمع التحية،\n${companyName}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#24352f"><h2 style="color:#0b3d3a">تذكير بسداد الفاتورة</h2><p>السادة <strong>${input.customerName}</strong>،</p><p>نود تذكيركم بأن الفاتورة رقم <strong dir="ltr">${input.invoiceNumber}</strong> ما زال عليها رصيد مستحق قدره <strong dir="ltr">${Number(input.outstanding).toFixed(2)} SAR</strong>، وكان تاريخ الاستحقاق <strong dir="ltr">${input.dueDate}</strong>.</p><p>يرجى التواصل معنا لتأكيد موعد السداد.</p>${input.publicAppUrl ? `<p><a href="${input.publicAppUrl}">فتح بوابة المتابعة</a></p>` : ""}<p>مع التحية،<br/>${companyName}</p></div>`;
  return { subject, text, html };
}

export async function sendPaymentReminderEmail(input: PaymentReminderEmailInput) {
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  const message = buildPaymentReminderEmail(input);
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: input.to, subject: message.subject, text: message.text, html: message.html });
  transporter.close();
  return { messageId: info.messageId, subject: message.subject };
}

export function buildWhatsAppReminderUrl(input: Omit<PaymentReminderEmailInput, "to"> & { phone: string }) {
  const phone = input.phone.replace(/[^\d]/g, "");
  const message = `السلام عليكم ${input.customerName}، نذكركم بالفاتورة ${input.invoiceNumber} التي عليها رصيد مستحق ${Number(input.outstanding).toFixed(2)} SAR، وتاريخ الاستحقاق ${input.dueDate}. نرجو التواصل معنا لتأكيد موعد السداد. مع التحية، ${input.companyName || PRODUCT_BRAND.bilingual}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
