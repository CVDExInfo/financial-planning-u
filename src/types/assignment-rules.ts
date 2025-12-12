/**
 * Assignment Rules Templates
 * Pre-built rule templates reflecting industry best practices for cost allocation
 */

export type AssignmentRuleKind = 
  | 'porcentaje'       // Percentage-based driver
  | 'monto_fijo'       // Fixed monthly amount
  | 'split_mod'        // MOD split across projects
  | 'actividad'        // Activity-based (tickets, cases)
  | 'capacidad';       // Capacity-based (bandwidth, users, ports)

export interface AssignmentRuleTemplate {
  /** Unique template ID */
  id: string;
  
  /** Short Spanish title */
  name: string;
  
  /** Spanish value-add explanation */
  description: string;
  
  /** Rule kind/type */
  kind: AssignmentRuleKind;
  
  /** Typical use cases (Spanish) */
  typicalUseCases: string[];
  
  /** Sample configuration for this template */
  sampleConfig: Record<string, unknown>;
  
  /** Whether this is a recommended template */
  isRecommended: boolean;
  
  /** Optional icon/emoji for UI */
  icon?: string;
}

/**
 * Library of pre-built assignment rule templates
 * Based on industry best practices for MSP, telco, and IT outsourcing
 */
export const ASSIGNMENT_RULE_TEMPLATES: AssignmentRuleTemplate[] = [
  {
    id: 'tpl-mod-percentage',
    name: 'Distribución por % de MOD planificada',
    description: 'Distribuye costos indirectos proporcionalmente al esfuerzo (MOD) asignado a cada proyecto. Ideal para gastos compartidos como herramientas, capacitación y overhead.',
    kind: 'porcentaje',
    typicalUseCases: [
      'Licencias de herramientas compartidas',
      'Capacitación del equipo',
      'Gastos de administración / PMO',
    ],
    sampleConfig: {
      driver: 'mod_planificado',
      calculation: 'percentage',
      scope: 'all_active_projects',
      example: {
        proyecto_a_mod: 100000,
        proyecto_b_mod: 200000,
        costo_a_distribuir: 30000,
        resultado_a: 10000, // 30000 * (100000/300000)
        resultado_b: 20000, // 30000 * (200000/300000)
      },
    },
    isRecommended: true,
    icon: '📊',
  },
  {
    id: 'tpl-fixed-monthly',
    name: 'Asignación fija mensual por rubro indirecto',
    description: 'Asigna un monto fijo mensual a proyectos o centros de costo específicos. Útil para servicios recurrentes con costo predecible (licencias, suscripciones).',
    kind: 'monto_fijo',
    typicalUseCases: [
      'Licencias SaaS fijas',
      'Conectividad dedicada',
      'Contratos de soporte técnico',
    ],
    sampleConfig: {
      driver: 'fixed_amount',
      allocation_type: 'monthly_fixed',
      example: {
        licencia_observabilidad: 5000,
        proyecto_target: 'proj_abc123',
        frecuencia: 'mensual',
      },
    },
    isRecommended: true,
    icon: '💰',
  },
  {
    id: 'tpl-80-20-split',
    name: 'Split 80/20 entre proyecto ancla y satélites',
    description: 'Divide costos entre un proyecto principal (80%) y proyectos secundarios (20%). Común cuando hay un cliente dominante que consume la mayoría de recursos compartidos.',
    kind: 'split_mod',
    typicalUseCases: [
      'NOC compartido con cliente principal',
      'Infraestructura con uso mayoritario',
      'Equipo con dedicación asimétrica',
    ],
    sampleConfig: {
      driver: 'weighted_split',
      splits: [
        { project: 'ancla', percentage: 80 },
        { project: 'satélite_1', percentage: 15 },
        { project: 'satélite_2', percentage: 5 },
      ],
    },
    isRecommended: false,
    icon: '⚖️',
  },
  {
    id: 'tpl-tickets-driver',
    name: 'Driver por cantidad de tickets / casos',
    description: 'Asigna costos basándose en el volumen de tickets o casos atendidos por proyecto. Refleja carga de trabajo real del equipo de soporte.',
    kind: 'actividad',
    typicalUseCases: [
      'Help Desk / Service Desk',
      'Soporte N2/N3',
      'Gestión de incidentes',
    ],
    sampleConfig: {
      driver: 'ticket_count',
      calculation: 'proportional',
      period: 'monthly',
      example: {
        proyecto_a_tickets: 120,
        proyecto_b_tickets: 80,
        total_tickets: 200,
        costo_soporte: 10000,
        resultado_a: 6000, // 10000 * (120/200)
        resultado_b: 4000, // 10000 * (80/200)
      },
    },
    isRecommended: true,
    icon: '🎫',
  },
  {
    id: 'tpl-users-driver',
    name: 'Driver por número de usuarios finales',
    description: 'Distribuye costos según la cantidad de usuarios o beneficiarios por proyecto. Apropiado para servicios de TI corporativa (correo, ERP, telefonía).',
    kind: 'capacidad',
    typicalUseCases: [
      'Plataformas colaborativas (M365, Google Workspace)',
      'Sistemas ERP / CRM compartidos',
      'Telefonía corporativa',
    ],
    sampleConfig: {
      driver: 'user_count',
      calculation: 'per_user',
      example: {
        proyecto_a_usuarios: 500,
        proyecto_b_usuarios: 1500,
        costo_por_usuario: 10,
        resultado_a: 5000,  // 500 * 10
        resultado_b: 15000, // 1500 * 10
      },
    },
    isRecommended: true,
    icon: '👥',
  },
  {
    id: 'tpl-capacity-driver',
    name: 'Driver por capacidad contratada (Mbps, puertos, etc.)',
    description: 'Asigna costos proporcionales a la capacidad técnica contratada por cada proyecto. Común en infraestructura de red, data center o nube.',
    kind: 'capacidad',
    typicalUseCases: [
      'Ancho de banda / enlaces WAN',
      'Puertos de switch / racks de DC',
      'Recursos cloud (vCPU, RAM, storage)',
    ],
    sampleConfig: {
      driver: 'technical_capacity',
      unit: 'mbps', // o 'ports', 'vcpu', etc.
      example: {
        proyecto_a_capacity: 100, // 100 Mbps
        proyecto_b_capacity: 400, // 400 Mbps
        costo_infraestructura: 5000,
        resultado_a: 1000, // 5000 * (100/500)
        resultado_b: 4000, // 5000 * (400/500)
      },
    },
    isRecommended: true,
    icon: '🔌',
  },
  {
    id: 'tpl-hours-consumed',
    name: 'Driver por horas consumidas (field service)',
    description: 'Distribuye costos de campo (transporte, viáticos) según horas técnicas consumidas en sitio. Ideal para servicios remotos y manos en campo.',
    kind: 'actividad',
    typicalUseCases: [
      'Mantenimiento preventivo en sitio',
      'Smart hands / manos remotas',
      'Instalación y puesta en marcha',
    ],
    sampleConfig: {
      driver: 'field_hours',
      calculation: 'hourly_rate',
      example: {
        proyecto_a_horas: 40,
        proyecto_b_horas: 60,
        costo_hora_campo: 50,
        resultado_a: 2000, // 40 * 50
        resultado_b: 3000, // 60 * 50
      },
    },
    isRecommended: false,
    icon: '🔧',
  },
  {
    id: 'tpl-sla-tier',
    name: 'Driver por tier de SLA / criticidad',
    description: 'Asigna costos diferenciados según el nivel de servicio (gold/silver/bronze) o criticidad del proyecto. Proyectos críticos pagan más por cobertura 24x7 y respuesta prioritaria.',
    kind: 'porcentaje',
    typicalUseCases: [
      'NOC 24x7 con prioridades diferenciadas',
      'Soporte escalonado por SLA',
      'Servicios premium vs. estándar',
    ],
    sampleConfig: {
      driver: 'sla_tier',
      tiers: {
        gold: { weight: 1.5, description: '24x7, respuesta < 15 min' },
        silver: { weight: 1.0, description: '12x5, respuesta < 1 hr' },
        bronze: { weight: 0.5, description: '8x5, respuesta < 4 hrs' },
      },
      example: {
        proyecto_gold: { tier: 'gold', base_cost: 10000, resultado: 15000 },
        proyecto_silver: { tier: 'silver', base_cost: 10000, resultado: 10000 },
        proyecto_bronze: { tier: 'bronze', base_cost: 10000, resultado: 5000 },
      },
    },
    isRecommended: false,
    icon: '⚡',
  },
];

/**
 * Get templates by kind
 */
export function getTemplatesByKind(kind: AssignmentRuleKind): AssignmentRuleTemplate[] {
  return ASSIGNMENT_RULE_TEMPLATES.filter(tpl => tpl.kind === kind);
}

/**
 * Get recommended templates only
 */
export function getRecommendedTemplates(): AssignmentRuleTemplate[] {
  return ASSIGNMENT_RULE_TEMPLATES.filter(tpl => tpl.isRecommended);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): AssignmentRuleTemplate | undefined {
  return ASSIGNMENT_RULE_TEMPLATES.find(tpl => tpl.id === id);
}
