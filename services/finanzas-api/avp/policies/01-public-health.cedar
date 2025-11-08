// Health is public (or environment-gated)
permit (
  principal, 
  action in [Finanzas::Action::"ViewHealth"], 
  resource
)
when { 
  context.env == "dev" || context.env == "stg" || context.env == "prod" 
};
