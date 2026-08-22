export type AccountHierarchyNode = { id: number; parentId: number | null; accountType: string };

export function assertAccountParentAllowed(nodes: AccountHierarchyNode[], accountId: number | undefined, parentId: number | undefined, accountType: string) {
  if (!parentId) return;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) throw new Error("الحساب الأب غير موجود ضمن الشركة.");
  if (parent.accountType !== accountType) throw new Error("يجب أن يطابق نوع الحساب نوع الحساب الأب.");
  if (!accountId) return;
  if (parentId === accountId) throw new Error("لا يمكن ربط الحساب بنفسه كحساب أب.");
  const visited = new Set<number>();
  let cursor: number | null = parentId;
  while (cursor) {
    if (cursor === accountId) throw new Error("لا يمكن نقل الحساب تحت أحد حساباته الفرعية.");
    if (visited.has(cursor)) throw new Error("هيكل الحسابات الحالي يحوي دورة غير صالحة.");
    visited.add(cursor);
    cursor = nodes.find((node) => node.id === cursor)?.parentId ?? null;
  }
}
