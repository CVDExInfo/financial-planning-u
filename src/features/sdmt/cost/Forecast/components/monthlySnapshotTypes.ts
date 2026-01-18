import { isLabor } from '@/lib/rubros-category-utils';

export interface ForecastCell {
  line_item_id: string;
  rubroId?: string;
  projectId?: string;
  projectName?: string;
  description?: string;
  category?: string;
  month: number;
  planned: number;
  forecast: number;
  actual: number;
  variance: number;
  last_updated?: string;
  updated_by?: string;
}

export interface MonthlyBudgetInput {
  month: number;
  budget: number;
}

export type GroupingMode = 'project' | 'rubro';
export type CostTypeFilter = 'all' | 'labor' | 'non-labor';
export type CostType = 'labor' | 'non-labor';

export type SnapshotStatus =
  | 'En Meta'
  | 'En Riesgo'
  | 'Sobre Presupuesto'
  | 'Sin Presupuesto'
  | 'Sin Datos';

export interface SnapshotRow {
  id: string;
  name: string;
  code?: string;
  budget: number;
  forecast: number;
  actual: number;
  varianceBudget: number;
  varianceBudgetPercent: number | null;
  varianceForecast: number;
  varianceForecastPercent: number | null;
  status: SnapshotStatus;
  children?: SnapshotRow[];
  parentId?: string;
  projectId?: string;
  rubroId?: string;
  category?: string;
  costType?: CostType;
}

export const deriveCostType = (category?: string): CostType | undefined => {
  if (!category) return undefined;
  return isLabor(category) ? 'labor' : 'non-labor';
};
