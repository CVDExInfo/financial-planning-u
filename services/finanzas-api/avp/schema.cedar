namespace Finanzas {

  // === Entity types ===
  entity User = {};
  entity Group = {};  // e.g., SDT, FIN, AUD, PMO, EXEC_RO, VENDOR
  entity Project = {
    owner: User
  };
  entity Adjustment = {
    project: Project,
    owner: User
  };
  entity Allocation = {
    project: Project,
    owner: User
  };
  entity Provider = {
    project: Project,
    owner: User
  };
  entity PayrollFile = {
    project: Project,
    uploader: User
  };
  entity Prefactura = {
    project: Project,
    createdBy: User,
    status: String
  };
  entity Rule = {
    project: Project,
    createdBy: User
  };
  entity Rubro = {};   // catalog is organization-wide read

  // === Actions (verbs we enforce in AVP) ===
  action ViewHealth appliesTo {
    principal: [User],
    resource: [Project]
  };
  
  action ViewRubros appliesTo {
    principal: [User],
    resource: [Rubro]
  };
  
  action ViewRules appliesTo {
    principal: [User],
    resource: [Rule]
  };
  
  action ModifyRules appliesTo {
    principal: [User],
    resource: [Rule]
  };

  action ViewProviders appliesTo {
    principal: [User],
    resource: [Provider]
  };
  
  action UpsertProvider appliesTo {
    principal: [User],
    resource: [Provider]
  };

  action ViewAdjustments appliesTo {
    principal: [User],
    resource: [Adjustment]
  };
  
  action CreateAdjustment appliesTo {
    principal: [User],
    resource: [Adjustment]
  };

  action ViewProjects appliesTo {
    principal: [User],
    resource: [Project]
  };
  
  action CreateProject appliesTo {
    principal: [User],
    resource: [Project]
  };

  action BulkAllocate appliesTo {
    principal: [User],
    resource: [Allocation]
  };
  
  action ViewPlan appliesTo {
    principal: [User],
    resource: [Project]
  };

  action IngestPayroll appliesTo {
    principal: [User],
    resource: [PayrollFile]
  };
  
  action CloseMonth appliesTo {
    principal: [User],
    resource: [Project]
  };

  action ViewPrefactura appliesTo {
    principal: [User],
    resource: [Prefactura]
  };
  
  action SendPrefactura appliesTo {
    principal: [User],
    resource: [Prefactura]
  };
  
  action ApprovePrefactura appliesTo {
    principal: [User],
    resource: [Prefactura]
  };
}

// === Context schema (what Lambdas pass to AVP) ===
type FinanzasContext = {
  // copied from API/GW or Lambda:
  "jwt_groups": Set<String>,        // Cognito groups from the ID token
  "http_method": String,
  "route": String,                  // e.g. "/projects/{id}/allocations:bulk"
  "project_id"?: String,            // from path param when applicable
  "env": String                     // "dev" | "stg" | "prod"
};
