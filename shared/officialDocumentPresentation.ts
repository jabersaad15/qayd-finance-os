export type OfficialDocumentSeller = {
  legalNameAr: string;
  commercialRegistration?: string | null;
  unifiedNumber?: string | null;
  vatNumber?: string | null;
  nationalAddress?: string | null;
  city?: string | null;
};

const statusLabels: Record<string, string> = { draft: "مسودة", sent: "مرسل", accepted: "مقبول", rejected: "مرفوض", expired: "منتهي", converted: "تم تحويله", approved: "معتمدة", issued: "صادرة", paid: "مدفوعة", partially_paid: "مدفوعة جزئياً", cancelled: "ملغاة" };

export function getOfficialDocumentStatus(status?: string | null) {
  return status ? (statusLabels[status] ?? status) : null;
}

export function getOfficialSellerIdentity(seller: OfficialDocumentSeller) {
  return { legalNameAr: seller.legalNameAr, vatNumber: seller.vatNumber ?? null, registrationNumber: seller.commercialRegistration ?? seller.unifiedNumber ?? null, nationalAddress: seller.nationalAddress ?? seller.city ?? null };
}
