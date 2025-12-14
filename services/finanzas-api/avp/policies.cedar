// Policy Store: P3wQ5UBQ9YvLb4NaXmSTMG
// Policy ID: hhKNjToeFMfEtGyLuUjg6
// Grants FIN Cognito group access to Finanzas SD API (dev)

permit (
    principal in finanzassd::UserGroup::"us-east-2_FyHLtOhiY|FIN",
    action in [
        // Core reference data & health
        finanzassd::Action::"get /adjustments",
        finanzassd::Action::"post /adjustments",
        finanzassd::Action::"get /alerts",
        finanzassd::Action::"get /allocation-rules",
        finanzassd::Action::"get /catalog/rubros",
        finanzassd::Action::"get /health",
        // Legacy prefactura webhooks
        finanzassd::Action::"get /prefacturas/webhook",
        finanzassd::Action::"post /prefacturas/webhook",
        // Projects & plans
        finanzassd::Action::"get /projects",
        finanzassd::Action::"post /projects",
        finanzassd::Action::"get /projects/{id}/plan",
        // Legacy per-project rubros (id-based)
        finanzassd::Action::"get /projects/{id}/rubros",
        finanzassd::Action::"post /projects/{id}/rubros",
        // Providers
        finanzassd::Action::"get /providers",
        finanzassd::Action::"post /providers",
        // Close month & payroll
        finanzassd::Action::"post /close-month",
        finanzassd::Action::"post /payroll/ingest",
        // Legacy handoff
        finanzassd::Action::"post /projects/{id}/handoff",
        // Allocations (bulk)
        finanzassd::Action::"put /projects/{id}/allocations:bulk",
        // ───── New routes from API mapping ─────
        // Baseline (PMO estimator handshake)
        finanzassd::Action::"get /baseline/{baseline_id}",
        finanzassd::Action::"post /baseline",
        // Prefacturas (pre-billing)
        finanzassd::Action::"get /prefacturas",
        finanzassd::Action::"post /prefacturas",
        // Forecast
        finanzassd::Action::"get /plan/forecast",
        // Project billing & handoff (projectId-based)
        finanzassd::Action::"get /projects/{projectId}/billing",
        finanzassd::Action::"get /projects/{projectId}/handoff",
        finanzassd::Action::"post /projects/{projectId}/handoff",
        // Project rubros (projectId-based)
        finanzassd::Action::"get /projects/{projectId}/rubros",
        finanzassd::Action::"post /projects/{projectId}/rubros",
        finanzassd::Action::"delete /projects/{projectId}/rubros/{rubroId}",
        // Document uploads
        finanzassd::Action::"post /uploads/docs",
        // Handoff lifecycle updates
        finanzassd::Action::"put /handoff/{handoffId}",
        // Invoices
        finanzassd::Action::"get /projects/{projectId}/invoices",
        finanzassd::Action::"get /projects/{projectId}/invoices/{invoiceId}",
        finanzassd::Action::"put /projects/{projectId}/invoices/{invoiceId}/status"
    ],
    resource in finanzassd::Application::"finanzas-sd-api-dev"
);

// Hub visibility for SDM/PMO/SDMT/ADMIN cohorts
permit (
    principal in [
        finanzassd::UserGroup::"us-east-2_FyHLtOhiY|SDM",
        finanzassd::UserGroup::"us-east-2_FyHLtOhiY|PMO",
        finanzassd::UserGroup::"us-east-2_FyHLtOhiY|SDMT",
        finanzassd::UserGroup::"us-east-2_FyHLtOhiY|ADMIN",
    ],
    action == finanzassd::Action::"hub.view",
    resource in finanzassd::Application::"finanzas-sd-api-dev"
);
