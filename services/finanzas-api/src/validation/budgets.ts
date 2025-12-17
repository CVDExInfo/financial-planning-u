import { z } from 'zod';

/**
 * Annual All-In Budget Schema
 */
export const AnnualBudgetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  amount: z.number().min(0),
  currency: z.string().default('USD'),
  updated_at: z.string().datetime().optional(),
  updated_by: z.string().email().optional(),
});

export type AnnualBudget = z.infer<typeof AnnualBudgetSchema>;

/**
 * Annual Budget Create/Update Schema
 */
export const AnnualBudgetUpsertSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  amount: z.number().min(0),
  currency: z.string().default('USD'),
});

export type AnnualBudgetUpsert = z.infer<typeof AnnualBudgetUpsertSchema>;

/**
 * Annual Budget Overview Response Schema
 */
export const AnnualBudgetOverviewSchema = z.object({
  year: z.number().int(),
  budgetAllIn: z.object({
    amount: z.number(),
    currency: z.string(),
  }).nullable(),
  totals: z.object({
    planned: z.number(),
    forecast: z.number(),
    actual: z.number(),
    varianceBudgetVsForecast: z.number(),
    varianceBudgetVsActual: z.number(),
    percentBudgetConsumedActual: z.number().nullable(),
    percentBudgetConsumedForecast: z.number().nullable(),
  }),
  byProject: z.array(z.object({
    projectId: z.string(),
    projectCode: z.string().optional(),
    planned: z.number(),
    forecast: z.number(),
    actual: z.number(),
  })).optional(),
});

export type AnnualBudgetOverview = z.infer<typeof AnnualBudgetOverviewSchema>;

/**
 * Parse and validate annual budget upsert data
 */
export function parseAnnualBudgetUpsert(data: unknown): AnnualBudgetUpsert {
  return AnnualBudgetUpsertSchema.parse(data);
}

/**
 * Safe parse annual budget upsert
 */
export function safeParseAnnualBudgetUpsert(data: unknown) {
  return AnnualBudgetUpsertSchema.safeParse(data);
}
