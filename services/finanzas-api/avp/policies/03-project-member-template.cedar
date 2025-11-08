// TEMPLATE: allow project members to view and post adjustments, view plan
// This is a template that requires instantiation with a specific project
@id("ProjectMemberAccess")
permit (
  principal,
  action in [
    Finanzas::Action::"ViewAdjustments", 
    Finanzas::Action::"CreateAdjustment", 
    Finanzas::Action::"ViewPlan"
  ],
  resource
)
when {
  principal in ?project &&
  (resource.project == ?project || context.project_id == ?project) &&
  (context.jwt_groups.contains("SDT") || context.jwt_groups.contains("FIN"))
};
