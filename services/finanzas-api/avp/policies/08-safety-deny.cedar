// Organization-wide safety deny for suspended users
// If a user is flagged "suspended" in user directory (fed as context or attribute),
// deny everything as a safety net.
forbid (
  principal, 
  action, 
  resource
)
when { 
  context has suspended && context.suspended == true 
};
