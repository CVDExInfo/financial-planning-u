import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/domain";
import {
  canAccessRoute as legacyCanAccessRoute,
  canPerformAction as legacyCanPerformAction,
  getRoleLevel,
} from "@/lib/auth";

export type FinanzasRole = "PMO" | "SDMT" | "VENDOR" | "EXEC_RO";

const ROLE_PRIORITY: FinanzasRole[] = ["SDMT", "PMO", "EXEC_RO", "VENDOR"];

type PermissionCheck = {
  anyRoles?: UserRole[];
  allDecisions?: string[];
};

function normalizeGroups(groups: unknown): string[] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups.map((g) => String(g).toUpperCase());
  if (typeof groups === "string") {
    return groups
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((g) => g.toUpperCase());
  }
  return [];
}

export function useFinanzasRole(): FinanzasRole | null {
  const { groups, currentRole, roles, user } = useAuth();
  const normalizedGroups = normalizeGroups(
    groups.length ? groups : user?.claims?.["cognito:groups"],
  );

  const candidateRoles: FinanzasRole[] = [];
  const hasGroup = (group: string) => normalizedGroups.includes(group.toUpperCase());

  if (hasGroup("SDMT")) candidateRoles.push("SDMT");
  if (hasGroup("PMO")) candidateRoles.push("PMO");
  if (hasGroup("EXEC_RO")) candidateRoles.push("EXEC_RO");
  if (hasGroup("VENDOR")) candidateRoles.push("VENDOR");

  if (candidateRoles.length === 0) {
    const fallback =
      (currentRole as FinanzasRole | undefined) ||
      (roles[0] as FinanzasRole | undefined);
    return fallback ?? null;
  }

  candidateRoles.sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));
  return candidateRoles[0];
}

/**
 * Permission resolver that combines Cognito groups with optional
 * AVP (Policy Store) decisions embedded in the ID token.
 */
export function usePermissions() {
  const { groups, roles, avpDecisions, currentRole: activeRole } = useAuth();
  const finanzasRole = useFinanzasRole();

  const normalizedGroups = useMemo(
    () => groups.map((group) => group.toUpperCase()),
    [groups],
  );

  const roleSet = useMemo(() => new Set<UserRole>(roles), [roles]);
  const decisionSet = useMemo(
    () => new Set(avpDecisions?.map((d) => d.toLowerCase()) || []),
    [avpDecisions],
  );

  const effectiveRole: FinanzasRole =
    finanzasRole || (activeRole as FinanzasRole | undefined) ||
    (roles[0] as FinanzasRole | undefined) ||
    "SDMT";

  const hasGroup = (group: string) => normalizedGroups.includes(group.toUpperCase());

  const hasRole = (role: UserRole) => roleSet.has(role);

  const hasAnyRole = (required: UserRole[] = []) => {
    if (required.length === 0) return true;
    return required.some((role) => roleSet.has(role));
  };

  const hasDecision = (decision: string) => decisionSet.has(decision.toLowerCase());

  const hasAllDecisions = (decisions: string[] = []) => {
    if (!decisions.length) return true;
    return decisions.every((decision) => hasDecision(decision));
  };

  const can = ({ anyRoles, allDecisions }: PermissionCheck) =>
    hasAnyRole(anyRoles) && hasAllDecisions(allDecisions);

  const isReadOnly = () =>
    effectiveRole === "EXEC_RO" ||
    hasDecision("deny-write") ||
    (!hasDecision("allow-write") && effectiveRole !== "SDMT");

  const canAccessRoute = (route: string) => legacyCanAccessRoute(route, effectiveRole);

  const canPerformAction = (action: string) => legacyCanPerformAction(action, effectiveRole);

  const hasPremiumFinanzasFeatures =
    (import.meta.env.VITE_FINZ_PREMIUM_ENABLED ?? "false") === "true" ||
    hasDecision("finz-premium");

  const hasMinimumRole = (minimumRole: UserRole) =>
    getRoleLevel(effectiveRole) >= getRoleLevel(minimumRole);

  const canCreate = () => canPerformAction("create");
  const canUpdate = () => canPerformAction("update");
  const canDelete = () => canPerformAction("delete");
  const canApprove = () => canPerformAction("approve");

  const isPMO = effectiveRole === "PMO";
  const isSDMT = effectiveRole === "SDMT";
  const isVendor = effectiveRole === "VENDOR";
  const isExecRO = effectiveRole === "EXEC_RO";

  const canManageCosts = isSDMT;
  const canCreateBaseline = isSDMT;
  const canUploadInvoices = isSDMT || isVendor;
  const canEdit = isSDMT;

  return {
    roles,
    groups,
    role: effectiveRole,
    currentRole: effectiveRole,
    hasGroup,
    hasRole,
    hasAnyRole,
    hasDecision,
    hasAllDecisions,
    can,
    isReadOnly,
    canAccessRoute,
    canPerformAction,
    hasMinimumRole,
    canCreate,
    canUpdate,
    hasPremiumFinanzasFeatures,
    canDelete,
    canApprove,
    isPMO,
    isSDMT,
    isVendor,
    isExecRO,
    canManageCosts,
    canCreateBaseline,
    canUploadInvoices,
    canEdit,
  };
}

export default usePermissions;
