// Prefactura governance: AUD, FIN, PMO can view
permit (
  principal, 
  action in [Finanzas::Action::"ViewPrefactura"], 
  resource
)
when { 
  context.jwt_groups.contains("AUD") || 
  context.jwt_groups.contains("FIN") || 
  context.jwt_groups.contains("PMO") 
};

// FIN can send prefacturas
permit (
  principal, 
  action in [Finanzas::Action::"SendPrefactura"], 
  resource
)
when { 
  context.jwt_groups.contains("FIN") 
};

// PMO and FIN can approve prefacturas
permit (
  principal, 
  action in [Finanzas::Action::"ApprovePrefactura"], 
  resource
)
when { 
  context.jwt_groups.contains("PMO") || 
  context.jwt_groups.contains("FIN") 
};
