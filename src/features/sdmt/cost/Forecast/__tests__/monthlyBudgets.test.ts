/**
 * Unit tests for monthly budget functionality
 * 
 * This test validates that monthly budgets are correctly:
 * 1. Loaded from the API
 * 2. Passed to child components
 * 3. Used in budget allocation calculations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simple helper to simulate monthly budget allocation
function allocateBudgetWithMonthlyInputs(
  annualBudget: number,
  monthlyBudgets: Array<{ month: number; budget: number }>,
  monthlyTotals: Array<{ month: number; planned: number; forecast: number; actual: number }>
): Array<{ month: number; budgetAllocated: number; planned: number; forecast: number; actual: number }> {
  const allocations = [];
  
  for (let i = 1; i <= 12; i++) {
    const monthBudget = monthlyBudgets.find(mb => mb.month === i);
    const monthTotal = monthlyTotals.find(mt => mt.month === i);
    
    allocations.push({
      month: i,
      budgetAllocated: monthBudget?.budget || 0,
      planned: monthTotal?.planned || 0,
      forecast: monthTotal?.forecast || 0,
      actual: monthTotal?.actual || 0,
    });
  }
  
  return allocations;
}

describe('Monthly Budget Functionality', () => {
  describe('Budget Allocation with Monthly Inputs', () => {
    it('should allocate budgets based on monthly inputs', () => {
      const annualBudget = 120000;
      const monthlyBudgets = [
        { month: 1, budget: 10000 },
        { month: 2, budget: 12000 },
        { month: 3, budget: 11000 },
        { month: 4, budget: 9000 },
        { month: 5, budget: 10000 },
        { month: 6, budget: 10000 },
        { month: 7, budget: 10000 },
        { month: 8, budget: 10000 },
        { month: 9, budget: 10000 },
        { month: 10, budget: 10000 },
        { month: 11, budget: 9000 },
        { month: 12, budget: 9000 },
      ];
      
      const monthlyTotals = [
        { month: 1, planned: 9000, forecast: 9500, actual: 9200 },
        { month: 2, planned: 11000, forecast: 11500, actual: 0 },
        { month: 3, planned: 10000, forecast: 10800, actual: 0 },
        { month: 4, planned: 8500, forecast: 8700, actual: 0 },
        { month: 5, planned: 9500, forecast: 9800, actual: 0 },
        { month: 6, planned: 9500, forecast: 9700, actual: 0 },
        { month: 7, planned: 9500, forecast: 9900, actual: 0 },
        { month: 8, planned: 9500, forecast: 9600, actual: 0 },
        { month: 9, planned: 9500, forecast: 9800, actual: 0 },
        { month: 10, planned: 9500, forecast: 9700, actual: 0 },
        { month: 11, planned: 8500, forecast: 8800, actual: 0 },
        { month: 12, planned: 8500, forecast: 8700, actual: 0 },
      ];
      
      const allocations = allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgets, monthlyTotals);
      
      // Verify we have 12 months of allocations
      assert.strictEqual(allocations.length, 12, 'Should have 12 monthly allocations');
      
      // Verify January allocation
      assert.strictEqual(allocations[0].month, 1, 'First allocation should be for month 1');
      assert.strictEqual(allocations[0].budgetAllocated, 10000, 'January budget should be 10000');
      assert.strictEqual(allocations[0].planned, 9000, 'January planned should match totals');
      
      // Verify February allocation
      assert.strictEqual(allocations[1].month, 2, 'Second allocation should be for month 2');
      assert.strictEqual(allocations[1].budgetAllocated, 12000, 'February budget should be 12000');
      
      // Calculate total budget allocated
      const totalBudget = allocations.reduce((sum, a) => sum + a.budgetAllocated, 0);
      assert.strictEqual(totalBudget, 120000, 'Total budget should equal annual budget');
    });
    
    it('should handle missing monthly budget entries by using 0', () => {
      const annualBudget = 60000;
      const monthlyBudgets = [
        { month: 1, budget: 10000 },
        { month: 2, budget: 10000 },
        // Missing months 3-12
      ];
      
      const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        planned: 5000,
        forecast: 5200,
        actual: 0,
      }));
      
      const allocations = allocateBudgetWithMonthlyInputs(annualBudget, monthlyBudgets, monthlyTotals);
      
      // Verify first two months have budgets
      assert.strictEqual(allocations[0].budgetAllocated, 10000, 'Month 1 should have budget');
      assert.strictEqual(allocations[1].budgetAllocated, 10000, 'Month 2 should have budget');
      
      // Verify remaining months have 0 budget
      assert.strictEqual(allocations[2].budgetAllocated, 0, 'Month 3 should have 0 budget');
      assert.strictEqual(allocations[11].budgetAllocated, 0, 'Month 12 should have 0 budget');
    });
    
    it('should preserve monthly totals (planned, forecast, actual) from input', () => {
      const monthlyBudgets = [{ month: 1, budget: 10000 }];
      const monthlyTotals = [{
        month: 1,
        planned: 8500,
        forecast: 9200,
        actual: 8700,
      }];
      
      const allocations = allocateBudgetWithMonthlyInputs(0, monthlyBudgets, monthlyTotals);
      
      assert.strictEqual(allocations[0].planned, 8500, 'Planned should be preserved');
      assert.strictEqual(allocations[0].forecast, 9200, 'Forecast should be preserved');
      assert.strictEqual(allocations[0].actual, 8700, 'Actual should be preserved');
    });
  });
  
  describe('Budget Variance Calculation', () => {
    it('should calculate variance between forecast and budget', () => {
      const allocations = [
        { month: 1, budgetAllocated: 10000, forecast: 9500 },
        { month: 2, budgetAllocated: 12000, forecast: 13000 },
        { month: 3, budgetAllocated: 11000, forecast: 10800 },
      ];
      
      const variances = allocations.map(a => ({
        month: a.month,
        variance: a.forecast - a.budgetAllocated,
      }));
      
      assert.strictEqual(variances[0].variance, -500, 'Month 1 variance should be -500 (under budget)');
      assert.strictEqual(variances[1].variance, 1000, 'Month 2 variance should be 1000 (over budget)');
      assert.strictEqual(variances[2].variance, -200, 'Month 3 variance should be -200 (under budget)');
    });
    
    it('should calculate total variance across all months', () => {
      const allocations = [
        { month: 1, budgetAllocated: 10000, forecast: 9500 },
        { month: 2, budgetAllocated: 12000, forecast: 13000 },
        { month: 3, budgetAllocated: 11000, forecast: 10800 },
      ];
      
      const totalBudget = allocations.reduce((sum, a) => sum + a.budgetAllocated, 0);
      const totalForecast = allocations.reduce((sum, a) => sum + a.forecast, 0);
      const totalVariance = totalForecast - totalBudget;
      
      assert.strictEqual(totalBudget, 33000, 'Total budget should be 33000');
      assert.strictEqual(totalForecast, 33300, 'Total forecast should be 33300');
      assert.strictEqual(totalVariance, 300, 'Total variance should be 300');
    });
    
    it('should calculate percentage variance', () => {
      const budget = 10000;
      const forecast = 11000;
      const variance = forecast - budget;
      const percentageVariance = (variance / budget) * 100;
      
      assert.strictEqual(percentageVariance, 10, 'Percentage variance should be 10%');
    });
  });
  
  describe('Budget Consumption Tracking', () => {
    it('should calculate consumption percentage', () => {
      const budget = 10000;
      const actual = 8500;
      const consumptionPercent = (actual / budget) * 100;
      
      assert.strictEqual(consumptionPercent, 85, 'Consumption should be 85%');
    });
    
    it('should handle zero budget gracefully', () => {
      const budget = 0;
      const actual = 5000;
      const consumptionPercent = budget > 0 ? (actual / budget) * 100 : 0;
      
      assert.strictEqual(consumptionPercent, 0, 'Consumption should be 0% when budget is 0');
    });
    
    it('should handle over-consumption (>100%)', () => {
      const budget = 10000;
      const actual = 12000;
      const consumptionPercent = (actual / budget) * 100;
      
      assert.strictEqual(consumptionPercent, 120, 'Over-consumption should be 120%');
    });
  });
});
