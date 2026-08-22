export type SingleCompanySetupFields = {
  tenantId: number;
  companyId: number;
  vatNumber: string;
  city: string;
  fiscalYearStartMonth: string;
  periodStart: string;
  periodEnd: string;
};

export function toSingleCompanyConfigureInput(fields: SingleCompanySetupFields) {
  return { tenantId: fields.tenantId, companyId: fields.companyId, vatNumber: fields.vatNumber.trim() || undefined, city: fields.city.trim(), fiscalYearStartMonth: Number(fields.fiscalYearStartMonth), periodStart: fields.periodStart, periodEnd: fields.periodEnd };
}
