/**
 * Shared types for rubro attachment to projects
 * Used across Catálogo de Rubros and Estructura de Costos
 */

import { z } from 'zod';

/**
 * Project Rubro Attachment - what we actually persist for PROJECT#.../RUBRO#... items
 */
export interface ProjectRubroAttachment {
  /** Canonical rubro ID (e.g., MOD-LEAD, GSV-REU) */
  rubroId: string;
  
  /** Legacy ID if migrating from old format (e.g., RB0001) */
  _legacy_id?: string;
  
  /** Project ID this rubro is attached to */
  projectId: string;
  
  /** Category code from taxonomy (e.g., MOD, GSV, TEC) */
  categoria_codigo: string;
  
  /** Category name in Spanish */
  categoria: string;
  
  /** Line code (same as rubroId for canonical) */
  linea_codigo: string;
  
  /** Line item name/description */
  linea_gasto: string;
  
  /** Detailed description (read-only, from taxonomy) */
  descripcion: string;
  
  /** Cost type: OPEX or CAPEX */
  tipo_costo: 'OPEX' | 'CAPEX';
  
  /** Execution type: Una vez (one-time) or Recurrente (recurring) */
  tipo: 'una_vez' | 'recurrente';
  
  /** Start month (1-based index) */
  mes_inicio: number;
  
  /** Duration in months */
  plazo_meses: number;
  
  /** Quantity */
  cantidad: number;
  
  /** Unit cost */
  costo_unitario: number;
  
  /** Currency code */
  moneda: 'USD' | 'EUR' | 'MXN' | 'COP';
  
  /** Optional notes/comments */
  notas?: string;
  
  /** Audit fields */
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Form data for adding/editing a rubro
 */
export interface RubroFormData {
  /** Selected category code */
  categoria_codigo: string;
  
  /** Selected rubro ID (canonical) */
  rubroId: string;
  
  /** Auto-filled from taxonomy */
  descripcion?: string;
  
  /** Una vez or Recurrente */
  tipo: 'una_vez' | 'recurrente';
  
  /** Start month (1-12) */
  mes_inicio: number;
  
  /** Duration in months */
  plazo_meses: number;
  
  /** Quantity */
  cantidad: number;
  
  /** Unit cost */
  costo_unitario: number;
  
  /** Currency */
  moneda: 'USD' | 'EUR' | 'MXN' | 'COP';
  
  /** Optional notes */
  notas?: string;
}

/**
 * Zod schema for validation
 */
export const RubroFormSchema = z.object({
  categoria_codigo: z.string().min(1, 'Categoría es requerida'),
  rubroId: z.string().min(1, 'Línea de gasto es requerida'),
  descripcion: z.string().optional(),
  tipo: z.enum(['una_vez', 'recurrente'], {
    message: 'Tipo es requerido',
  }),
  mes_inicio: z.number().min(1, 'Mes de inicio debe ser al menos 1').max(12, 'Mes de inicio debe ser máximo 12'),
  plazo_meses: z.number().min(1, 'Plazo debe ser al menos 1 mes'),
  cantidad: z.number().min(0, 'Cantidad debe ser mayor o igual a 0'),
  costo_unitario: z.number().min(0, 'Costo unitario debe ser mayor o igual a 0'),
  moneda: z.enum(['USD', 'EUR', 'MXN', 'COP'], {
    message: 'Moneda es requerida',
  }),
  notas: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional(),
});

export type RubroFormSchemaType = z.infer<typeof RubroFormSchema>;
