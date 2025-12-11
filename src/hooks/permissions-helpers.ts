import { mapGroupsToRoles, type FinanzasRole } from "../lib/jwt";

// Role priority (highest to lowest)
// ADMIN = Administrator (highest priority - full access to all projects and settings)
// PMO = Project Management Office (can manage plans, forecasts, track metrics across all projects)
// SDMT = Service Delivery Management Team (can manage all costs, rubros, allocations across all projects)
// SDM = Service Delivery Manager (can manage only their assigned projects)
// PM = Project Manager (project-level access)
// EXEC_RO = Executive Read-Only (can view dashboards, reports, but no modifications)
// VENDOR = Vendor/External Partner (can upload invoices, view limited data)
export const ROLE_PRIORITY: FinanzasRole[] = [
  "ADMIN",
  "PMO",
  "SDMT",
  "SDM",
  "PM",
  "EXEC_RO",
  "VENDOR",
];

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
