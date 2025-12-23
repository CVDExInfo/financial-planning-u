/**
 * Spanish (ES) localization constants for Finanzas SD
 * 
 * This file centralizes all UI text for the Finanzas Service Delivery module.
 * All text should use Spanish vocabulary aligned with Ikusi business terminology.
 */

export const ES_TEXTS = {
  // Navigation & Main Sections
  nav: {
    portfolio: "Portafolio Financiero",
    costStructure: "Estructura de Costos",
    forecast: "Gestión de Pronóstico",
    reconciliation: "Conciliación de Facturas",
    changes: "Cambios y Ajustes",
    rubros: "Catálogo de Rubros",
    rules: "Reglas de Asignación",
    adjustments: "Ajustes",
    providers: "Proveedores",
    cashflow: "Flujo de Caja",
    scenarios: "Escenarios",
    hubDesempeno: "Hub de Desempeño",
  },

  // Portfolio View
  portfolio: {
    title: "Portafolio Financiero",
    description: "Visión consolidada de proyectos activos y presupuestos",
    projectsTab: "Proyectos",
    summaryTab: "Resumen Ejecutivo",
    createProject: "Crear Proyecto",
    modVsIndirect: "MOD vs Costos Indirectos",
    modLabel: "Mano de Obra Directa",
    indirectLabel: "Costos Indirectos",
    payrollCoverage: "Cobertura de Nómina",
    payrollTarget: "Nómina Objetivo (HR)",
    payrollReal: "Nómina Real",
    payrollDifference: "Diferencia",
    coverageOk: "OK",
    coverageAtRisk: "En Riesgo",
    serviceMonth: "Mes de servicio",
    monthOfTotal: "de",
  },

  // SDMT Cost Structure (formerly "Cost Catalog")
  costStructure: {
    title: "Estructura de Costos del Proyecto",
    description: "Gestión de rubros y categorías de costos",
    addRubro: "Agregar Rubro",
    editRubro: "Editar Rubro",
    deleteRubro: "Eliminar Rubro",
    category: "Categoría",
    subtype: "Subtipo",
    rubroDescription: "Descripción",
    quantity: "Cantidad",
    unitCost: "Costo Unitario",
    total: "Total",
    currency: "Moneda",
    startMonth: "Mes Inicio",
    endMonth: "Mes Fin",
    recurring: "Recurrente",
    mod: "MOD",
    indirect: "Indirecto",
  },

  // Forecast Management
  forecast: {
    title: "Gestión de Pronóstico",
    description: "Ajusta el pronóstico de cada rubro mes a mes de acuerdo a la operación real",
    plan: "Plan (P)",
    forecast: "Pronóstico (F)",
    actual: "Real (A)",
    variance: "Variación",
    month: "Mes",
    total: "Total",
    saveChanges: "Guardar Cambios",
    changesSaved: "Cambios guardados",
    loadingForecast: "Cargando pronóstico...",
    noData: "No hay datos disponibles",
    forecastVariance: "Variación de Pronóstico",
    realVariance: "Variación Real",
    monthlyForecastTrends: "Tendencias Mensuales de Pronóstico",
    varianceAnalysis: "Análisis de Variación",
    varianceAnalysisVsBudget: "Análisis de Variación vs Presupuesto",
    forecastOverBudget: "Pronóstico Sobre Presupuesto",
    forecastUnderBudget: "Pronóstico Bajo Presupuesto",
    actualOverBudget: "Real Sobre Presupuesto",
    actualUnderBudget: "Real Bajo Presupuesto",
    overUnderBudget: "Sobre/Bajo Presupuesto",
    forecastAccuracy: "Precisión de Pronóstico",
    largestVariance: "Mayor Variación",
    forecastVsPlanned: "Pronóstico vs Planificado",
    overBudget: "Sobre Presupuesto",
    underBudget: "Bajo Presupuesto",
    onTarget: "En Meta",
    budgetUtilization: "Utilización de Presupuesto",
    notAvailable: "No Disponible",
    budgetLineLabel: "Presupuesto",
  },

  // Reconciliation
  reconciliation: {
    title: "Conciliación de Facturas",
    description: "Concilia las facturas recibidas con el pronóstico establecido",
    invoice: "Factura",
    invoiceNumber: "Número de Factura",
    invoiceDate: "Fecha de Factura",
    invoiceAmount: "Monto de Factura",
    expected: "Esperado",
    difference: "Diferencia",
    status: "Estado",
    reconciled: "Conciliado",
    pending: "Pendiente",
    uploadInvoice: "Cargar Factura",
  },

  // Roles & Permissions
  roles: {
    pm: "Project Manager (PM)",
    sdm: "Service Delivery Manager (SDM)",
    pmo: "PMO",
    finanzas: "Finanzas",
    auditor: "Auditor",
    assignSDM: "Asignar SDM",
    readOnly: "Solo Lectura",
    sdmResponsibility: "A partir de esta etapa, el control de pronóstico y conciliación es responsabilidad del SDM",
    pmReadOnlyNote: "Como PM, esta vista es de solo lectura después de la aceptación del baseline",
    sdmAccess: "Acceso limitado a proyectos asignados",
  },

  // Changes & Approvals
  changes: {
    title: "Solicitudes de Cambio",
    description: "Gestión de cambios y aprobaciones de rubros",
    requestChange: "Solicitar Cambio",
    approveChange: "Aprobar Cambio",
    rejectChange: "Rechazar Cambio",
    pending: "En Aprobación",
    approved: "Aprobado",
    rejected: "Rechazado",
    reason: "Motivo",
  },

  // Baselines & PMO
  baseline: {
    queueTitle: "Cola de Baselines",
    queueDescription: "Rastrea la entrega y aceptación de baselines",
    projectBaselines: "Baselines de Proyecto",
    projectBaselinesDescription: "Ver el estado de aceptación y rechazo de las líneas base para todos los proyectos",
    all: "Todos",
    pending: "Pendientes",
    pendingReview: "Pendiente de Revisión",
    accepted: "Aceptadas",
    rejected: "Rechazadas",
    missingRubros: "Rubros Faltantes",
    acceptedBy: "Aceptado por",
    rejectedBy: "Rechazado por",
    acceptedAt: "Aceptado el",
    rejectedAt: "Rechazado el",
    viewRubros: "Ver Rubros",
    reviewAndResubmit: "Revisar y reenviar",
    viewDetails: "Ver Detalles",
    baselineId: "ID de Baseline",
    status: "Estado",
    rubrosBreakdown: "Desglose de Costos",
    labor: "MOD (Labor)",
    indirect: "Indirectos",
    total: "Total",
    noBaselinesFound: "No se encontraron baselines con el filtro seleccionado",
    rejectionComments: "Comentarios de Rechazo",
    rejectionFeedback: "Retroalimentación del SDMT sobre baselines rechazados",
    date: "Fecha",
    reason: "Razón",
    project: "Proyecto",
    client: "Cliente",
    actions: "Acciones",
    rubros: "Rubros",
  },

  // Planner (formerly Estimator)
  planner: {
    title: "Planificador",
    backToPlanner: "Volver al Planificador",
    createBaseline: "Crear Baseline",
    submitBaseline: "Enviar Baseline",
  },

  // Cost Categories
  categories: {
    mod: "Mano de Obra Directa",
    indirect: "Costos Indirectos",
    materials: "Materiales",
    equipment: "Equipamiento",
    services: "Servicios",
    other: "Otros",
  },

  // Parameters
  parameters: {
    fx: "Foreign Exchange (FX)",
    fxDescription: "Tipo de cambio para conversión de moneda",
    // Indexation removed per item 3
  },

  // Common Actions
  actions: {
    save: "Guardar",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    add: "Agregar",
    search: "Buscar",
    filter: "Filtrar",
    export: "Exportar",
    import: "Importar",
    refresh: "Actualizar",
    close: "Cerrar",
    confirm: "Confirmar",
    back: "Volver",
    next: "Siguiente",
    previous: "Anterior",
    submit: "Enviar",
  },

  // Status
  status: {
    active: "Activo",
    inactive: "Inactivo",
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    completed: "Completado",
    inProgress: "En Progreso",
  },

  // Messages
  messages: {
    loading: "Cargando...",
    saving: "Guardando...",
    saved: "Guardado exitosamente",
    error: "Ha ocurrido un error",
    noData: "No hay datos disponibles",
    confirmDelete: "¿Estás seguro de que deseas eliminar este elemento?",
    unsavedChanges: "Tienes cambios sin guardar",
    accessDenied: "No tienes acceso a este recurso",
  },

  // Errors
  errors: {
    generic: "Ha ocurrido un error inesperado",
    network: "Error de conexión",
    unauthorized: "No autorizado",
    forbidden: "Acceso denegado",
    notFound: "No encontrado",
    validation: "Error de validación",
  },
} as const;

export type ESTexts = typeof ES_TEXTS;
