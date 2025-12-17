/**
 * Budget Simulation Tests
 * Validates the pure functions for budget simulation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeNumericInput,
  clampFactor,
  calculateBudgetMetrics,
  applyBudgetToTrends,
  calculateEstimatedProjection,
  applyBudgetSimulation,
  isValidSimulationState,
  type BudgetSimulationState,
  type ForecastMetrics,
} from '../budgetSimulation';

describe('Budget Simulation Utils', () => {
  describe('sanitizeNumericInput', () => {
    it('should parse clean numbers', () => {
      assert.strictEqual(sanitizeNumericInput('1000'), 1000);
      assert.strictEqual(sanitizeNumericInput(1000), 1000);
    });

    it('should handle currency formatting', () => {
      assert.strictEqual(sanitizeNumericInput('$1,000'), 1000);
      assert.strictEqual(sanitizeNumericInput('1,000,000'), 1000000);
      assert.strictEqual(sanitizeNumericInput('1 000'), 1000);
    });

    it('should handle empty and invalid inputs', () => {
      assert.strictEqual(sanitizeNumericInput(''), 0);
      assert.strictEqual(sanitizeNumericInput('abc'), 0);
    });
  });

  describe('clampFactor', () => {
    it('should clamp values to 0.5-2.0 range', () => {
      assert.strictEqual(clampFactor(0.3), 0.5);
      assert.strictEqual(clampFactor(2.5), 2.0);
      assert.strictEqual(clampFactor(1.0), 1.0);
    });
  });

  describe('calculateBudgetMetrics', () => {
    it('should calculate budget utilization metrics', () => {
      const baseMetrics: ForecastMetrics = {
        totalPlanned: 1000000,
        totalForecast: 1100000,
        totalActual: 900000,
        totalVariance: 100000,
        variancePercentage: 10,
        actualVariance: -100000,
        actualVariancePercentage: -10,
      };

      const result = calculateBudgetMetrics(baseMetrics, 1200000);

      assert.strictEqual(result.budgetTotal, 1200000);
      assert.strictEqual(result.budgetVarianceProjected, 100000); // 1200000 - 1100000
      assert.strictEqual(result.budgetVariancePlanned, 200000); // 1200000 - 1000000
      assert.strictEqual(result.pctUsedActual, 75); // (900000 / 1200000) * 100
      assert.strictEqual(result.budgetUtilization, (1100000 / 1200000) * 100);
    });

    it('should handle zero budget gracefully', () => {
      const baseMetrics: ForecastMetrics = {
        totalPlanned: 1000000,
        totalForecast: 1100000,
        totalActual: 900000,
        totalVariance: 100000,
        variancePercentage: 10,
        actualVariance: -100000,
        actualVariancePercentage: -10,
      };

      const result = calculateBudgetMetrics(baseMetrics, 0);

      assert.strictEqual(result.pctUsedActual, 0);
      assert.strictEqual(result.budgetUtilization, 0);
    });
  });

  describe('applyBudgetToTrends', () => {
    it('should add budget line to monthly trends', () => {
      const trends = [
        { month: 1, Planned: 100, Forecast: 110, Actual: 90 },
        { month: 2, Planned: 100, Forecast: 110, Actual: 90 },
      ];

      const result = applyBudgetToTrends(trends, 1200);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].Budget, 100); // 1200 / 12
      assert.strictEqual(result[1].Budget, 100);
    });
  });

  describe('calculateEstimatedProjection', () => {
    it('should calculate estimated projection with factor', () => {
      const actual = 500000;
      const planned = 1000000;
      const forecast = 1100000;
      const factor = 1.2;

      const result = calculateEstimatedProjection(actual, planned, forecast, factor);

      // estimated = actual + (remaining * factor)
      // remaining = 1000000 - 500000 = 500000
      // estimated = 500000 + (500000 * 1.2) = 1100000
      assert.strictEqual(result, 1100000);
    });

    it('should fall back to forecast when planned is zero', () => {
      const result = calculateEstimatedProjection(500000, 0, 1100000, 1.2);
      assert.strictEqual(result, 1100000);
    });
  });

  describe('applyBudgetSimulation', () => {
    const baseMetrics: ForecastMetrics = {
      totalPlanned: 1000000,
      totalForecast: 1100000,
      totalActual: 900000,
      totalVariance: 100000,
      variancePercentage: 10,
      actualVariance: -100000,
      actualVariancePercentage: -10,
    };

    it('should return base metrics when simulation disabled', () => {
      const simState: BudgetSimulationState = {
        enabled: false,
        budgetTotal: 1200000,
        factor: 1.0,
      };

      const result = applyBudgetSimulation(baseMetrics, simState);

      assert.strictEqual(result.budgetTotal, 0);
      assert.strictEqual(result.totalForecast, 1100000);
    });

    it('should apply budget simulation when enabled', () => {
      const simState: BudgetSimulationState = {
        enabled: true,
        budgetTotal: 1200000,
        factor: 1.0,
      };

      const result = applyBudgetSimulation(baseMetrics, simState);

      assert.strictEqual(result.budgetTotal, 1200000);
      assert.strictEqual(result.budgetVarianceProjected, 100000);
      assert.ok(result.budgetUtilization > 0);
    });

    it('should apply estimated override when provided', () => {
      const simState: BudgetSimulationState = {
        enabled: true,
        budgetTotal: 1200000,
        factor: 1.5,
        estimatedOverride: 1050000,
      };

      const result = applyBudgetSimulation(baseMetrics, simState);

      // Should use override instead of factor-based calculation
      assert.strictEqual(result.totalForecast, 1050000);
    });
  });

  describe('isValidSimulationState', () => {
    it('should validate enabled state with valid budget', () => {
      const state: BudgetSimulationState = {
        enabled: true,
        budgetTotal: 1000000,
        factor: 1.0,
      };

      assert.strictEqual(isValidSimulationState(state), true);
    });

    it('should invalidate enabled state with zero budget', () => {
      const state: BudgetSimulationState = {
        enabled: true,
        budgetTotal: 0,
        factor: 1.0,
      };

      assert.strictEqual(isValidSimulationState(state), false);
    });

    it('should always validate disabled state', () => {
      const state: BudgetSimulationState = {
        enabled: false,
        budgetTotal: '',
        factor: 1.0,
      };

      assert.strictEqual(isValidSimulationState(state), true);
    });
  });
});
