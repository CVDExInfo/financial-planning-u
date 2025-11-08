// FIN group can ingest payroll data
permit (
  principal,
  action in [Finanzas::Action::"IngestPayroll"],
  resource
)
when { 
  context.jwt_groups.contains("FIN") 
};
