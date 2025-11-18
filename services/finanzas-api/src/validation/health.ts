import { z } from 'zod';

/**
 * Health Response Schema
 * Validates the response from the /health endpoint
 */
export const HealthResponseSchema = z.object({
  ok: z.boolean({
    message: 'ok must be a boolean',
  }),
  status: z.enum(['ok', 'UP', 'healthy']).optional(),
  env: z.enum(['dev', 'stg', 'prod']).optional(),
  version: z.string().optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Parse and validate health response data
 * @param data - Raw data to validate
 * @returns Validated HealthResponse
 * @throws ZodError if validation fails
 */
export function parseHealthResponse(data: unknown): HealthResponse {
  return HealthResponseSchema.parse(data);
}

/**
 * Safe parse health response (doesn't throw)
 * @param data - Raw data to validate
 * @returns Result object with success boolean and data/error
 */
export function safeParseHealthResponse(data: unknown) {
  return HealthResponseSchema.safeParse(data);
}
