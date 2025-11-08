// TEMPLATE: FIN members can close month for their projects
@id("CloseMonthAccess")
permit (
  principal, 
  action in [Finanzas::Action::"CloseMonth"], 
  resource
)
when {
  principal in ?project &&
  (resource == ?project || context.project_id == ?project) &&
  context.jwt_groups.contains("FIN")
};
