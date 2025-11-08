// Policy 1: Health is public (or environment-gated)
permit (
  principal, 
  action in [Finanzas::Action::"ViewHealth"], 
  resource
)
when { context.env == "dev" || context.env == "stg" || context.env == "prod" };

// Policy 2: Read-only catalog & rules access (SDT/FIN/AUD)
permit (
  principal,
  action in [Finanzas::Action::"ViewRubros", Finanzas::Action::"ViewRules"],
  resource
)
when { "SDT" in context.jwt_groups || "FIN" in context.jwt_groups || "AUD" in context.jwt_groups };

// Policy 3 TEMPLATE: allow project members to view and post adjustments, view plan
@policyTemplate ProjectMemberAccess(project: Finanzas::Project)
permit (
  principal,
  action in [Finanzas::Action::"ViewAdjustments", Finanzas::Action::"CreateAdjustment", Finanzas::Action::"ViewPlan"],
  resource
)
when {
  principal in project &&                                // user is assigned to this project
  (resource.project == project || context.project_id == project) &&
  ("SDT" in context.jwt_groups || "FIN" in context.jwt_groups)   // team groups
};

// Policy 4 TEMPLATE: finance team can modify rules/providers/allocations in a project
@policyTemplate FinanceWriteAccess(project: Finanzas::Project)
permit (
  principal,
  action in [Finanzas::Action::"ModifyRules", Finanzas::Action::"UpsertProvider", Finanzas::Action::"BulkAllocate"],
  resource
)
when {
  principal in project &&
  (resource.project == project || context.project_id == project) &&
  ("FIN" in context.jwt_groups)
};

// Policy 5: Payroll ingest (FIN only)
permit (
  principal,
  action in [Finanzas::Action::"IngestPayroll"],
  resource
)
when { "FIN" in context.jwt_groups };

// Policy 6 TEMPLATE: Close month (FIN only + project membership)
@policyTemplate CloseMonthAccess(project: Finanzas::Project)
permit (principal, action in [Finanzas::Action::"CloseMonth"], resource)
when {
  principal in project &&
  (resource == project || context.project_id == project) &&
  ("FIN" in context.jwt_groups)
};

// Policy 7: Prefactura governance (FIN can send, AUD can view, PMO/FIN approve)
permit (principal, action in [Finanzas::Action::"ViewPrefactura"], resource)
when { "AUD" in context.jwt_groups || "FIN" in context.jwt_groups || "PMO" in context.jwt_groups };

permit (principal, action in [Finanzas::Action::"SendPrefactura"], resource)
when { "FIN" in context.jwt_groups };

permit (principal, action in [Finanzas::Action::"ApprovePrefactura"], resource)
when { "PMO" in context.jwt_groups || "FIN" in context.jwt_groups };

// Policy 8: Organization-wide safety deny (optional)
// If a user is flagged "suspended" in your user directory (fed as context or attribute),
// deny everything as a safety net.
forbid (principal, action, resource)
when { context.suspended == true };
