export function createWorkspaceIdentity(vatNumber: string) {
  return {
    vatNumber,
    slug: `vat-${vatNumber}`,
  };
}
