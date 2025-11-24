import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types/domain";
import {
  canAccessRoute as legacyCanAccessRoute,
  canPerformAction as legacyCanPerformAction,
  getRoleLevel,
} from "@/lib/auth";

type PermissionCheck = {
  anyRoles?: UserRole[];
  allDecisions?: string[];
};

/**
 * Permission resolver that combines Cognito groups with optional
 * AVP (Policy Store) decisions embedded in the ID token.
 */
export function usePermissions() {
  const { groups, roles, avpDecisions } = useAuth();
  const currentRole = roles[0] ?? "SDMT";

  const normalizedGroups = useMemo(
    () => groups.map((group) => group.toLowerCase()),
    [groups]
  );

  const roleSet = useMemo(() => new Set<UserRole>(roles), [roles]);
  const decisionSet = useMemo(
    () => new Set(avpDecisions?.map((d) => d.toLowerCase()) || []),
    [avpDecisions]
  );

  const hasGroup = (group: string) =>
    normalizedGroups.includes(group.toLowerCase());

  const hasRole = (role: UserRole) => roleSet.has(role);

  const hasAnyRole = (required: UserRole[] = []) => {
    if (required.length === 0) return true;
    return required.some((role) => roleSet.has(role));
  };

  const hasDecision = (decision: string) =>
    decisionSet.has(decision.toLowerCase());

  const hasAllDecisions = (decisions: string[] = []) => {
    if (!decisions.length) return true;
    return decisions.every((decision) => hasDecision(decision));
  };

  const can = ({ anyRoles, allDecisions }: PermissionCheck) => {
    return hasAnyRole(anyRoles) && hasAllDecisions(allDecisions);
  };

  const isReadOnly = () =>
    hasRole("EXEC_RO") || hasDecision("deny-write") || !hasDecision("allow-write");

  const canAccessRoute = (route: string) =>
    legacyCanAccessRoute(route, currentRole);

  const canPerformAction = (action: string) =>
    legacyCanPerformAction(action, currentRole);

  const hasMinimumRole = (minimumRole: UserRole) =>
    getRoleLevel(currentRole) >= getRoleLevel(minimumRole);

  const canCreate = () => canPerformAction("create");
  const canUpdate = () => canPerformAction("update");
  const canDelete = () => canPerformAction("delete");
  const canApprove = () => canPerformAction("approve");

  return {
    roles,
    groups,
    currentRole,
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
    canDelete,
    canApprove,
  };
}

export default usePermissions;
