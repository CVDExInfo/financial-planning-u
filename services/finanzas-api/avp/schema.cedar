namespace finanzassd

// Entities reflected in policy store P3wQ5UBQ9YvLb4NaXmSTMG
entity User {}
entity UserGroup {}
entity Application {}

// Relationship: users are members of Cognito groups
User in UserGroup

// Actions mapped 1:1 to API routes
action "get /adjustments"        appliesTo (User, Application);
action "post /adjustments"       appliesTo (User, Application);
action "get /alerts"             appliesTo (User, Application);
action "get /allocation-rules"   appliesTo (User, Application);
action "get /catalog/rubros"     appliesTo (User, Application);
action "get /health"             appliesTo (User, Application);
action "get /prefacturas/webhook" appliesTo (User, Application);
action "post /prefacturas/webhook" appliesTo (User, Application);
action "get /projects"           appliesTo (User, Application);
action "post /projects"          appliesTo (User, Application);
action "get /projects/{id}/plan" appliesTo (User, Application);
action "get /projects/{id}/rubros" appliesTo (User, Application);
action "post /projects/{id}/rubros" appliesTo (User, Application);
action "get /providers"          appliesTo (User, Application);
action "post /providers"         appliesTo (User, Application);
action "post /close-month"       appliesTo (User, Application);
action "post /payroll/ingest"    appliesTo (User, Application);
action "post /projects/{id}/handoff" appliesTo (User, Application);
action "put /projects/{id}/allocations:bulk" appliesTo (User, Application);
action "delete /projects/{projectId}/rubros/{rubroId}" appliesTo (User, Application);
action "get /baseline/{baseline_id}" appliesTo (User, Application);
action "post /baseline"          appliesTo (User, Application);
action "get /plan/forecast"      appliesTo (User, Application);
action "get /prefacturas"        appliesTo (User, Application);
action "post /prefacturas"       appliesTo (User, Application);
action "get /projects/{projectId}/billing" appliesTo (User, Application);
action "get /projects/{projectId}/handoff" appliesTo (User, Application);
action "post /projects/{projectId}/handoff" appliesTo (User, Application);
action "get /projects/{projectId}/rubros" appliesTo (User, Application);
action "post /projects/{projectId}/rubros" appliesTo (User, Application);
action "post /uploads/docs"      appliesTo (User, Application);
action "put /handoff/{handoffId}" appliesTo (User, Application);
action "get /projects/{projectId}/invoices" appliesTo (User, Application);
action "get /projects/{projectId}/invoices/{invoiceId}" appliesTo (User, Application);
action "put /projects/{projectId}/invoices/{invoiceId}/status" appliesTo (User, Application);

// Action grouping anchor (FIN)
action "FIN" appliesTo (UserGroup, Application);

context {}
