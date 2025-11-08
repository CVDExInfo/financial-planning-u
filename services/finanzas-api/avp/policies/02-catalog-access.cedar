// Read-only catalog & rules access for SDT/FIN/AUD groups
permit (
  principal,
  action in [Finanzas::Action::"ViewRubros", Finanzas::Action::"ViewRules"],
  resource
)
when { 
  context.jwt_groups.contains("SDT") || 
  context.jwt_groups.contains("FIN") || 
  context.jwt_groups.contains("AUD") 
};
