// TEMPLATE: finance team can modify rules/providers/allocations in a project
@id("FinanceWriteAccess")
permit (
  principal,
  action in [
    Finanzas::Action::"ModifyRules", 
    Finanzas::Action::"UpsertProvider", 
    Finanzas::Action::"BulkAllocate"
  ],
  resource
)
when {
  principal in ?project &&
  (resource.project == ?project || context.project_id == ?project) &&
  context.jwt_groups.contains("FIN")
};
