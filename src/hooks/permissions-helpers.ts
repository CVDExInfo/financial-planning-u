import { mapGroupsToRoles, type FinanzasRole } from "../lib/jwt";

export const ROLE_PRIORITY: FinanzasRole[] = ["SDMT", "PMO", "EXEC_RO", "VENDOR"];

export function normalizeGroups(groups: unknown): string[] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups.map((g) => String(g));
  if (typeof groups === "string") {
    return groups
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((g) => g.trim());
  }
  return [];
}

export function resolveFinanzasRole(
  groups: string[],
  currentRole?: FinanzasRole | null,
  availableRoles: FinanzasRole[] = [],
): FinanzasRole | null {
  const normalizedGroups = normalizeGroups(groups);
  const mappedFromGroups = normalizedGroups.length
    ? mapGroupsToRoles(normalizedGroups)
    : [];

  if (mappedFromGroups.length) {
    const unique = Array.from(new Set(mappedFromGroups));
    unique.sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));
    return unique[0];
  }

  if (currentRole) return currentRole;
  if (availableRoles.length) return availableRoles[0];

  return null;
}
