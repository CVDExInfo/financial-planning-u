export type SampleRubro = {
  rubroId: string;
  description: string;
  qty: number;
  unitCost: number;
  type: "Recurring" | "One-time";
  duration: string;
  category: string;
};

export type SampleForecastCell = {
  line_item_id: string;
  month: number;
  planned: number;
  forecast?: number;
  actual?: number;
};

export type SampleProject = {
  id: string;
  code: string;
  nombre: string;
  cliente: string;
  start_date: string;
  end_date: string;
  mod_total: number;
  currency: "USD" | "MXN";
  rubros: SampleRubro[];
  forecast?: SampleForecastCell[];
};

export const sampleProjects: SampleProject[] = [
  {
    id: "P-OPS-001",
    code: "OPS-NOC-24x7",
    nombre: "Managed NOC & Field Ops",
    cliente: "Ikusi Enterprise",
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    mod_total: 240_000,
    currency: "USD",
    rubros: [
      {
        rubroId: "R-NOC-TIER2",
        description: "NOC Tier 2 coverage (24x7)",
        qty: 1,
        unitCost: 12000,
        type: "Recurring",
        duration: "M1-M12",
        category: "OPEX",
      },
      {
        rubroId: "R-FIELD-DISPATCH",
        description: "Field dispatch pack (Mexico north)",
        qty: 6,
        unitCost: 850,
        type: "Recurring",
        duration: "M1-M12",
        category: "OPEX",
      },
    ],
    forecast: [
      {
        line_item_id: "R-NOC-TIER2",
        month: 1,
        planned: 12000,
        forecast: 12000,
        actual: 11850,
      },
      {
        line_item_id: "R-FIELD-DISPATCH",
        month: 1,
        planned: 5100,
        forecast: 5100,
        actual: 4800,
      },
    ],
  },
  {
    id: "P-WIFI-002",
    code: "CAPEX-WIFI",
    nombre: "Campus WiFi Modernization",
    cliente: "Ikusi Retail",
    start_date: "2024-03-01",
    end_date: "2024-11-30",
    mod_total: 180_000,
    currency: "USD",
    rubros: [
      {
        rubroId: "R-AP-BUNDLES",
        description: "WiFi 6 access point bundles",
        qty: 45,
        unitCost: 950,
        type: "One-time",
        duration: "M3",
        category: "CAPEX",
      },
      {
        rubroId: "R-DESIGN-SVC",
        description: "RF design & survey",
        qty: 1,
        unitCost: 7800,
        type: "One-time",
        duration: "M2",
        category: "OPEX",
      },
    ],
    forecast: [
      {
        line_item_id: "R-AP-BUNDLES",
        month: 3,
        planned: 42_750,
        forecast: 42_750,
        actual: 0,
      },
      {
        line_item_id: "R-DESIGN-SVC",
        month: 2,
        planned: 7800,
        forecast: 7800,
        actual: 7800,
      },
    ],
  },
  {
    id: "P-SOC-003",
    code: "SOC-LITE",
    nombre: "SOC Lite Observability",
    cliente: "Ikusi Digital",
    start_date: "2024-02-01",
    end_date: "2024-12-31",
    mod_total: 90_000,
    currency: "USD",
    rubros: [
      {
        rubroId: "R-SOC-AGENTS",
        description: "SOC agent licensing",
        qty: 500,
        unitCost: 12,
        type: "Recurring",
        duration: "M2-M12",
        category: "OPEX",
      },
      {
        rubroId: "R-SOC-ONBOARD",
        description: "Onboarding & playbook setup",
        qty: 1,
        unitCost: 6500,
        type: "One-time",
        duration: "M2",
        category: "OPEX",
      },
    ],
    forecast: [
      {
        line_item_id: "R-SOC-AGENTS",
        month: 2,
        planned: 6000,
        forecast: 6000,
        actual: 0,
      },
      {
        line_item_id: "R-SOC-ONBOARD",
        month: 2,
        planned: 6500,
        forecast: 6500,
        actual: 0,
      },
    ],
  },
];
