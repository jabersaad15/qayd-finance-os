export const decimalMoneyPattern = /^\d+(\.\d{1,6})?$/;

export function isValidOnRequestPrice(value: string | undefined): boolean {
  return Boolean(value && decimalMoneyPattern.test(value) && Number(value) > 0);
}
