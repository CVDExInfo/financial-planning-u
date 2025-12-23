/**
 * Unit tests for transformLineItemsToForecast
 * Validates transformation of line items to forecast cells
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { transformLineItemsToForecast } from '../transformLineItemsToForecast';
import type { LineItem } from '@/types/domain';

describe('transformLineItemsToForecast', () => {
  it('should transform simple line item to monthly cells', () => {
    const lineItems: LineItem[] = [{
      id: 'MOD-LEAD',
      description: 'Lead Engineer',
      category: 'Mano de Obra Directa',
      start_month: 1,
      end_month: 3,
      unit_cost: 1000,
      qty: 1,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    // Should create 3 cells (one for each active month)
    assert.strictEqual(cells.length, 3);
    
    // Check first month
    assert.strictEqual(cells[0].line_item_id, 'MOD-LEAD');
    assert.strictEqual(cells[0].description, 'Lead Engineer');
    assert.strictEqual(cells[0].category, 'Mano de Obra Directa');
    assert.strictEqual(cells[0].month, 1);
    assert.ok(Math.abs(cells[0].planned - 1000 / 3) < 0.01);
    assert.ok(Math.abs(cells[0].forecast - 1000 / 3) < 0.01);
    assert.strictEqual(cells[0].actual, 0);
    assert.strictEqual(cells[0].variance, 0);
    
    // Check second month
    assert.strictEqual(cells[1].month, 2);
    assert.ok(Math.abs(cells[1].planned - 1000 / 3) < 0.01);
    
    // Check third month
    assert.strictEqual(cells[2].month, 3);
    assert.ok(Math.abs(cells[2].planned - 1000 / 3) < 0.01);
  });

  it('should handle line item spanning full year', () => {
    const lineItems: LineItem[] = [{
      id: 'INFRA-SERVER',
      description: 'Server Infrastructure',
      category: 'Infrastructure',
      start_month: 1,
      end_month: 12,
      unit_cost: 500,
      qty: 2,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    // Should create 12 cells (one for each month)
    assert.strictEqual(cells.length, 12);
    
    // Total across all months should be 1000 (500 * 2)
    const total = cells.reduce((sum, cell) => sum + cell.planned, 0);
    assert.ok(Math.abs(total - 1000) < 0.01);
    
    // Each month gets equal share
    cells.forEach(cell => {
      assert.ok(Math.abs(cell.planned - 1000 / 12) < 0.01);
    });
  });

  it('should handle empty line items array', () => {
    const cells = transformLineItemsToForecast([], 12);
    
    assert.strictEqual(cells.length, 0);
  });

  it('should handle null/undefined input gracefully', () => {
    const cells = transformLineItemsToForecast(null as any, 12);
    
    assert.strictEqual(cells.length, 0);
  });

  it('should handle line items with default start/end months', () => {
    const lineItems: LineItem[] = [{
      id: 'DEFAULT-ITEM',
      description: 'Default Item',
      category: 'Other',
      // No start_month or end_month specified - should default to 1-12
      unit_cost: 1200,
      qty: 1,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    } as LineItem];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    // Should default to full year (12 cells)
    assert.strictEqual(cells.length, 12);
    
    // Total should be 1200
    const total = cells.reduce((sum, cell) => sum + cell.planned, 0);
    assert.ok(Math.abs(total - 1200) < 0.01);
    
    // Each month gets equal share
    cells.forEach(cell => {
      assert.ok(Math.abs(cell.planned - 100) < 0.01);
    });
  });

  it('should handle multiple line items', () => {
    const lineItems: LineItem[] = [
      {
        id: 'ITEM-1',
        description: 'Item 1',
        category: 'Category A',
        start_month: 1,
        end_month: 6,
        unit_cost: 600,
        qty: 1,
        currency: 'USD',
        one_time: false,
        recurring: true,
        amortization: 'none',
        capex_flag: false,
        indexation_policy: 'none',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'test-user',
      },
      {
        id: 'ITEM-2',
        description: 'Item 2',
        category: 'Category B',
        start_month: 7,
        end_month: 12,
        unit_cost: 300,
        qty: 2,
        currency: 'USD',
        one_time: false,
        recurring: true,
        amortization: 'none',
        capex_flag: false,
        indexation_policy: 'none',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: 'test-user',
      },
    ];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    // Item 1: 6 cells, Item 2: 6 cells = 12 total
    assert.strictEqual(cells.length, 12);
    
    // First 6 cells should be Item 1
    const item1Cells = cells.filter(c => c.line_item_id === 'ITEM-1');
    assert.strictEqual(item1Cells.length, 6);
    item1Cells.forEach(cell => {
      assert.ok(Math.abs(cell.planned - 100) < 0.01); // 600 / 6
    });
    
    // Last 6 cells should be Item 2
    const item2Cells = cells.filter(c => c.line_item_id === 'ITEM-2');
    assert.strictEqual(item2Cells.length, 6);
    item2Cells.forEach(cell => {
      assert.ok(Math.abs(cell.planned - 100) < 0.01); // 600 / 6 (300*2/6)
    });
  });

  it('should handle zero cost items', () => {
    const lineItems: LineItem[] = [{
      id: 'ZERO-ITEM',
      description: 'Zero Cost Item',
      category: 'Free',
      start_month: 1,
      end_month: 12,
      unit_cost: 0,
      qty: 1,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    // Should create 12 cells even with zero cost
    assert.strictEqual(cells.length, 12);
    cells.forEach(cell => {
      assert.strictEqual(cell.planned, 0);
      assert.strictEqual(cell.forecast, 0);
    });
  });

  it('should handle custom months parameter', () => {
    const lineItems: LineItem[] = [{
      id: 'CUSTOM-MONTHS',
      description: 'Custom Months Item',
      category: 'Test',
      start_month: 1,
      end_month: 6,
      unit_cost: 600,
      qty: 1,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    // Test with 6 months instead of 12
    const cells = transformLineItemsToForecast(lineItems, 6);
    
    assert.strictEqual(cells.length, 6);
    const total = cells.reduce((sum, cell) => sum + cell.planned, 0);
    assert.ok(Math.abs(total - 600) < 0.01);
  });

  it('should handle quantity multiplier correctly', () => {
    const lineItems: LineItem[] = [{
      id: 'QTY-TEST',
      description: 'Quantity Test',
      category: 'Resources',
      start_month: 1,
      end_month: 12,
      unit_cost: 100,
      qty: 5, // 5 units
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    const cells = transformLineItemsToForecast(lineItems, 12);
    
    assert.strictEqual(cells.length, 12);
    const total = cells.reduce((sum, cell) => sum + cell.planned, 0);
    assert.ok(Math.abs(total - 500) < 0.01); // 100 * 5
    cells.forEach(cell => {
      assert.ok(Math.abs(cell.planned - 500 / 12) < 0.01);
    });
  });

  it('should include projectId and projectName when provided', () => {
    const lineItems: LineItem[] = [{
      id: 'PROJECT-ITEM',
      description: 'Project Item',
      category: 'Test',
      start_month: 1,
      end_month: 2,
      unit_cost: 100,
      qty: 1,
      currency: 'USD',
      one_time: false,
      recurring: true,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: 'test-user',
    }];
    
    const cells = transformLineItemsToForecast(lineItems, 12, 'proj-123', 'Test Project');
    
    assert.strictEqual(cells.length, 2);
    cells.forEach(cell => {
      assert.strictEqual(cell.projectId, 'proj-123');
      assert.strictEqual(cell.projectName, 'Test Project');
    });
  });
});
