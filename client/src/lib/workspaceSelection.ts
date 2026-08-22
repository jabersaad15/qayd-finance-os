export type WorkspaceCandidate = {
  tenant?: { id?: number | null; status?: string | null } | null;
  company?: { id?: number | null; status?: string | null } | null;
};

/** Selects the first active, fully linked tenant/company workspace. */
export function selectActiveWorkspace<T extends WorkspaceCandidate>(items: readonly T[] | undefined): T | undefined {
  if (!items?.length) return undefined;
  return items.find((item) =>
    Boolean(item.tenant?.id && item.company?.id) &&
    item.tenant?.status === "active" &&
    item.company?.status === "active",
  )
    ?? items.find((item) => Boolean(item.tenant?.id && item.company?.id));
}
