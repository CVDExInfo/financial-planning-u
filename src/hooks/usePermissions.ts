import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { UserRole } from "../types/domain";
import {
  canAccessRoute as legacyCanAccessRoute,
  canPerformAction as legacyCanPerformAction,
} from "../lib/auth";
import { type FinanzasRole as JwtFinanzasRole } from "../lib/jwt";
import {
  resolveFinanzasRole,
  ROLE_PRIORITY,
} from "./permissions-helpers";

export type FinanzasRole = JwtFinanzasRole;


type PermissionCheck = {
  anyRoles?: UserRole[];
  allDecisions?: string[];
};

export function useFinanzasRole(): FinanzasRole | null {
  const { groups, currentRole, roles } = useAuth();
  return resolveFinanzasRole(groups, currentRole as FinanzasRole, roles as FinanzasRole[]);
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
  const decisionSet = useMemo(() => {
    const normalized = (avpDecisions || [])
      .filter((d): d is string => typeof d === "string" && d.length > 0)
      .map((d) => d.toLowerCase());
    return new Set(normalized);
  }, [avpDecisions]);

  const effectiveRole: FinanzasRole =
    finanzasRole ||
    (activeRole as FinanzasRole | undefined) ||
    (roles[0] as FinanzasRole | undefined) ||
    null;

  if (!effectiveRole) {
    return {
      roles,
      groups,
      role: null,
      currentRole: null,
      hasGroup: () => false,
      hasRole: () => false,
      hasAnyRole: () => false,
      hasDecision: () => false,
      hasAllDecisions: () => false,
      can: () => false,
      isReadOnly: () => true,
      canAccessRoute: () => false,
      canPerformAction: () => false,
      hasMinimumRole: () => false,
      canCreate: () => false,
      canUpdate: () => false,
      hasPremiumFinanzasFeatures: false,
      canDelete: () => false,
      canApprove: () => false,
      isPM: false,
      isPMO: false,
      isSDMT: false,
      isVendor: false,
      isExecRO: true,
      canManageCosts: false,
      canCreateBaseline: false,
      canUploadInvoices: false,
      canEdit: false,
    };
  }

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

  const canAccessRoute = (route: string) =>
    legacyCanAccessRoute(route, effectiveRole as UserRole);

  const canPerformAction = (action: string) =>
    legacyCanPerformAction(action, effectiveRole as UserRole);

  const hasPremiumFinanzasFeatures =
    (import.meta.env.VITE_FINZ_PREMIUM_ENABLED ?? "false") === "true" ||
    hasDecision("finz-premium");

  const hasMinimumRole = (minimumRole: UserRole) =>
    ROLE_PRIORITY.indexOf(effectiveRole) <=
    ROLE_PRIORITY.indexOf(minimumRole as FinanzasRole);

  const canCreate = () => canPerformAction("create");
  const canUpdate = () => canPerformAction("update");

  const isPMO = effectiveRole === "PMO";
  const isPM = effectiveRole === "PM";
  const isSDMT = effectiveRole === "SDMT";
  const isSDM = effectiveRole === "SDM";
  const isVendor = effectiveRole === "VENDOR";
  const isExecRO = effectiveRole === "EXEC_RO";
  const isAdmin = effectiveRole === "ADMIN";

  const canManageCosts = isSDMT || isSDM;
  const canCreateBaseline = isSDMT || isSDM;
  const canUploadInvoices = isSDMT || isVendor || isSDM;
  const canEdit = isSDMT || isSDM;
  const canDelete = isSDMT;
  const canApprove = isSDMT;

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
    isPM,
    isPMO,
    isSDMT,
    isSDM,
    isVendor,
    isExecRO,
    isAdmin,
    canManageCosts,
    canCreateBaseline,
    canUploadInvoices,
    canEdit,
  };
}

export default usePermissions;
