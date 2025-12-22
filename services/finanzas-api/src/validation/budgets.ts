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
 * Monthly Budget Entry Schema
 */
export const MonthlyBudgetEntrySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  amount: z.number().min(0),
});

export type MonthlyBudgetEntry = z.infer<typeof MonthlyBudgetEntrySchema>;

/**
 * Monthly Budget Schema
 */
export const MonthlyBudgetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  currency: z.string().default('USD'),
  months: z.array(MonthlyBudgetEntrySchema),
  updated_at: z.string().datetime().optional(),
  updated_by: z.string().optional(),
});

export type MonthlyBudget = z.infer<typeof MonthlyBudgetSchema>;

/**
 * Monthly Budget Upsert Schema
 */
export const MonthlyBudgetUpsertSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  currency: z.string().default('USD'),
  months: z.array(MonthlyBudgetEntrySchema).min(1, "At least one month entry is required"),
});

export type MonthlyBudgetUpsert = z.infer<typeof MonthlyBudgetUpsertSchema>;

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

/**
 * Parse and validate monthly budget upsert data
 */
export function parseMonthlyBudgetUpsert(data: unknown): MonthlyBudgetUpsert {
  return MonthlyBudgetUpsertSchema.parse(data);
}

/**
 * Safe parse monthly budget upsert
 */
export function safeParseMonthlyBudgetUpsert(data: unknown) {
  return MonthlyBudgetUpsertSchema.safeParse(data);
}
