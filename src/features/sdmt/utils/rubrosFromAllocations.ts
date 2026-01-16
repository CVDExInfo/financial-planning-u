export type Allocation = {
  rubroId?: string;
  rubro_id?: string;
  description?: string;
  amount?: number;
  month?: number;
  projectId?: string;
  project_id?: string;
};

export type Prefactura = {
  rubroId?: string;
  rubro_id?: string;
  description?: string;
  amount?: number;
  month?: number;
  projectId?: string;
  project_id?: string;
};

export type Rubro = {
  rubroId: string;
  description?: string;
  amount?: number;
  month?: number;
  projectId?: string;
};

const toRubroId = (item: Allocation | Prefactura): string =>
  item.rubroId || item.rubro_id || "unknown-rubro";

export const mapAllocationsToRubros = (allocations: Allocation[]): Rubro[] =>
  allocations.map((allocation) => ({
    rubroId: toRubroId(allocation),
    description: allocation.description,
    amount: allocation.amount,
    month: allocation.month,
    projectId: allocation.projectId || allocation.project_id,
  }));

export const mapPrefacturasToRubros = (prefacturas: Prefactura[]): Rubro[] =>
  prefacturas.map((prefactura) => ({
    rubroId: toRubroId(prefactura),
    description: prefactura.description,
    amount: prefactura.amount,
    month: prefactura.month,
    projectId: prefactura.projectId || prefactura.project_id,
  }));

export const rubrosFromAllocations = (allocations: Allocation[]): Rubro[] =>
  mapAllocationsToRubros(allocations);
