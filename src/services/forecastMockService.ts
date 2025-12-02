/**
 * Mock Service for Forecast API
 * Provides deterministic mock data when VITE_USE_MOCKS=true
 * Mirrors the real API contract defined in openapi/finanzas.yaml
 */

import type { ForecastCell } from "@/types/domain";
import forecastDataDefault from "@/mocks/forecast.json";
import forecastDataFintech from "@/mocks/forecast-fintech.json";
import forecastDataRetail from "@/mocks/forecast-retail.json";

const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS || "false") === "true";

// Map of project IDs to their mock data
const MOCK_DATA_MAP: Record<string, ForecastCell[]> = {
  "PROJ-2024-001": forecastDataDefault as ForecastCell[],
  "fintech-mvp": forecastDataFintech as ForecastCell[],
  "retail-portal": forecastDataRetail as ForecastCell[],
  // Default fallback for any other project
  default: forecastDataDefault as ForecastCell[],
};

/**
 * Get mock forecast data for a project
 * Returns deterministic data based on project ID
 */
export function getMockForecastData(
  projectId: string,
  periodMonths: number = 12
): {
  data: ForecastCell[];
  projectId: string;
  months: number;
  generated_at: string;
} {
  if (!USE_MOCKS) {
    throw new Error("Mock service called when VITE_USE_MOCKS is not enabled");
  }

  // Get appropriate mock data for this project
  const mockData = MOCK_DATA_MAP[projectId] || MOCK_DATA_MAP.default;

  // Filter data to requested period (default 12 months)
  const filteredData = mockData.filter((cell) => cell.month <= periodMonths);

  console.log(`[Mock] Returning ${filteredData.length} forecast cells for project ${projectId}`);

  return {
    data: filteredData,
    projectId,
    months: periodMonths,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Check if mock mode is enabled
 */
export function isMockModeEnabled(): boolean {
  return USE_MOCKS;
}

/**
 * Simulate network delay for realistic mock behavior
 */
export function mockDelay(ms: number = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
