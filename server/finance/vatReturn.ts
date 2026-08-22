import { addMoney, subtractMoney, type Money } from "./invariants";

export function summarizeVatReturn(input: { taxableSales: Money; outputVat: Money; inputVat: Money }) {
  return {
    taxableSales: input.taxableSales,
    outputVat: input.outputVat,
    inputVat: input.inputVat,
    netVatDue: subtractMoney(input.outputVat, input.inputVat),
  };
}

export function sumVatAmounts(values: Money[]): Money {
  return addMoney(values);
}
