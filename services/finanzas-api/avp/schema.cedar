namespace Finanzas

// === Entity types ===
entity User            {}
entity Group           {}  // e.g., SDT, FIN, AUD, PMO, EXEC_RO, VENDOR, SDM, ADMIN
entity Project         { 
  owner: User,
  sdmManagerEmail: String?   // Key field for ABAC - SDM manager's email
}
entity Adjustment      { project: Project, owner: User }
entity Allocation      { project: Project, owner: User }
entity Provider        { project: Project, owner: User }
entity PayrollFile     { project: Project, uploader: User }
entity Prefactura      { project: Project, createdBy: User, status: String }
entity Rule            { project: Project, createdBy: User }
entity Rubro           { }   // catalog is organization-wide read

// === Relationships ===
// A user can be a member of a group
User in Group

// Users can be assigned to projects
User in Project

// === Actions (verbs we enforce in AVP) ===
action ViewHealth       appliesTo (User, Project);
action ViewRubros       appliesTo (User, Rubro);
action ViewRules        appliesTo (User, Rule);
action ModifyRules      appliesTo (User, Rule);

action ViewProviders    appliesTo (User, Provider);
action UpsertProvider   appliesTo (User, Provider);

action ViewAdjustments  appliesTo (User, Adjustment);
action CreateAdjustment appliesTo (User, Adjustment);

action ViewProjects     appliesTo (User, Project);
action ListProjects     appliesTo (User, Project);
action GetProject       appliesTo (User, Project);
action CreateProject    appliesTo (User, Project);

action BulkAllocate     appliesTo (User, Allocation);
action ViewPlan         appliesTo (User, Project);

action IngestPayroll    appliesTo (User, PayrollFile);
action CloseMonth       appliesTo (User, Project);

action ViewPrefactura   appliesTo (User, Prefactura);
action SendPrefactura   appliesTo (User, Prefactura);
action ApprovePrefactura appliesTo (User, Prefactura);

// === Context schema (what Lambdas pass to AVP) ===
context {
  // copied from API/GW or Lambda:
  jwt_groups: Set<String>,        // Cognito groups from the ID token
  user_email: String?,            // User's email from JWT for ABAC comparisons
  http_method: String,
  route: String,                  // e.g. "/projects/{id}/allocations:bulk"
  project_id: String?,            // from path param when applicable
  env: String                     // "dev" | "stg" | "prod"
}
