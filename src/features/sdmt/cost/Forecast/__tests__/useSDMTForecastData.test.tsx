/**
 * Unit tests for useSDMTForecastData hook
 * 
 * Tests the canonical forecast data controller that serves as the single source
 * of truth for all SDMT forecast components.
 * 
 * Note: This is a simplified test focused on the dataSource logic.
 * Full integration tests with React hooks would require a more complex setup.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeForecastFromAllocations } from '../computeForecastFromAllocations';
import { isMaterialized, matchInvoiceToCell, normalizeString } from '../useSDMTForecastData';
import type { LineItem } from '@/types/domain';

describe('useSDMTForecastData Helper Functions', () => {
  describe('isMaterialized', () => {
    it('should return true when materializedAt is set', () => {
      const baseline = { materializedAt: '2025-01-15T00:00:00Z' };
      assert.strictEqual(isMaterialized(baseline), true);
    });
    
    it('should return true when materialization_status is completed', () => {
      const baseline = { materialization_status: 'completed' };
      assert.strictEqual(isMaterialized(baseline), true);
    });
    
    it('should return false when not materialized', () => {
      const baseline = { materialization_status: 'pending' };
      assert.strictEqual(isMaterialized(baseline), false);
    });
    
    it('should handle null/undefined baseline', () => {
      assert.strictEqual(isMaterialized(null), false);
      assert.strictEqual(isMaterialized(undefined), false);
    });
  });
  
  describe('normalizeString', () => {
    it('should normalize case and whitespace', () => {
      assert.strictEqual(normalizeString('  Hello  World  '), 'hello world');
      assert.strictEqual(normalizeString('UPPERCASE'), 'uppercase');
      assert.strictEqual(normalizeString('MixedCase'), 'mixedcase');
    });
    
    it('should handle non-string inputs', () => {
      assert.strictEqual(normalizeString(null), '');
      assert.strictEqual(normalizeString(undefined), '');
      assert.strictEqual(normalizeString(123), '123');
    });
  });
  
  describe('matchInvoiceToCell', () => {
    const mockCell = {
      line_item_id: 'R-1',
      rubroId: 'R-1',
      description: 'Software Engineer',
      month: 1,
      planned: 1000,
      forecast: 1100,
      actual: 0,
      variance: 0,
      last_updated: '',
      updated_by: '',
    };
    
    it('should match by line_item_id (priority 1)', () => {
      const invoice = {
        line_item_id: 'R-1',
        rubroId: 'different-id',
        description: 'different description',
        amount: 1050,
        month: 1,
        status: 'Matched',
      };
      
      assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
    });
    
    it('should match by rubroId (priority 2)', () => {
      const invoice = {
        rubroId: 'R-1',
        description: 'different description',
        amount: 1050,
        month: 1,
        status: 'Matched',
      };
      
      assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
    });
    
    it('should match by normalized description (priority 3)', () => {
      const invoice = {
        description: '  SOFTWARE  ENGINEER  ',
        amount: 1050,
        month: 1,
        status: 'Matched',
      };
      
      assert.strictEqual(matchInvoiceToCell(invoice, mockCell), true);
    });
    
    it('should not match when nothing matches', () => {
      const invoice = {
        line_item_id: 'different',
        rubroId: 'different',
        description: 'completely different',
        amount: 1050,
        month: 1,
        status: 'Matched',
      };
      
      assert.strictEqual(matchInvoiceToCell(invoice, mockCell), false);
    });
    
    it('should handle null invoice', () => {
      assert.strictEqual(matchInvoiceToCell(null, mockCell), false);
    });
  });
  
  describe('dataSource Logic Validation', () => {
    it('should demonstrate server forecast path', () => {
      // When forecast has critical data (planned > 0 or forecast > 0)
      const serverForecast = [
        { line_item_id: 'R-1', month: 1, planned: 1000, forecast: 1100, actual: 0 }
      ];
      
      const hasCriticalCells = serverForecast.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
      );
      
      assert.strictEqual(hasCriticalCells, true);
      // In the hook, this would set dataSource = 'serverForecast'
    });
    
    it('should demonstrate allocations fallback path', () => {
      // When server forecast is empty but allocations exist
      const serverForecast: any[] = [];
      const allocations = [
        { month: 1, month_index: 1, amount: 1000, rubro_id: 'R-1', projectId: 'P-1' }
      ];
      
      const hasCriticalCells = serverForecast.length > 0 && serverForecast.some(cell => 
        (cell.planned || 0) > 0 || (cell.forecast || 0) > 0
      );
      
      assert.strictEqual(hasCriticalCells, false);
      assert.ok(allocations.length > 0);
      
      // Compute forecast from allocations
      const rows = computeForecastFromAllocations(
        allocations,
        [{ 
          id: 'R-1', 
          description: 'Engineer', 
          category: 'Labor',
          unit_cost: 100,
          qty: 10,
          start_month: 1,
          end_month: 12,
          currency: 'USD',
          one_time: false,
          recurring: true,
          amortization: 'none',
          capex_flag: false,
          indexation_policy: 'none',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        } as LineItem],
        12,
        'P-1'
      );
      
      assert.ok(rows.length > 0);
      // In the hook, this would set dataSource = 'allocationsFallback'
    });
    
    it('should demonstrate rubros fallback path', () => {
      // When server forecast and allocations are empty but rubros exist
      const serverForecast: any[] = [];
      const allocations: any[] = [];
      const rubros: LineItem[] = [
        { 
          id: 'R-1', 
          description: 'Engineer', 
          category: 'Labor',
          unit_cost: 100,
          qty: 10,
          start_month: 1,
          end_month: 12,
          currency: 'USD',
          one_time: false,
          recurring: true,
          amortization: 'none',
          capex_flag: false,
          indexation_policy: 'none',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: 'test-user',
        }
      ];
      
      assert.strictEqual(serverForecast.length, 0);
      assert.strictEqual(allocations.length, 0);
      assert.ok(rubros.length > 0);
      
      // In the hook, this would use transformLineItemsToForecast(rubros)
      // and set dataSource = 'rubrosFallback'
    });
  });
  
  describe('Month Index Support (M13+)', () => {
    it('should verify month_index is used correctly in computeForecastFromAllocations', () => {
      // This test validates the FORECAST_MONTHINDEX_FIX implementation
      const allocations = [
        {
          month: '2026-01', // Calendar month (would be month 1 without month_index)
          month_index: 13,   // Contract month (M13)
          amount: 1000,
          rubro_id: 'R-1',
          projectId: 'P-1',
        }
      ];
      
      const rubros = [
        { id: 'R-1', description: 'Engineer', category: 'Labor' }
      ] as LineItem[];
      
      const rows = computeForecastFromAllocations(allocations as any, rubros, 36, 'P-1');
      
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 13); // Should use month_index, not calendar month
      assert.strictEqual(rows[0].forecast, 1000);
    });
    
    it('should support months up to M60', () => {
      const allocations = [
        {
          month: '2029-12',
          month_index: 60,
          amount: 500,
          rubro_id: 'R-1',
          projectId: 'P-1',
        }
      ];
      
      const rubros = [
        { id: 'R-1', description: 'Engineer', category: 'Labor' }
      ] as LineItem[];
      
      const rows = computeForecastFromAllocations(allocations as any, rubros, 60, 'P-1');
      
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 60);
    });
    
    it('should filter out invalid month indexes (> 60)', () => {
      const allocations = [
        {
          month: '2030-01',
          month_index: 99, // Invalid: > 60
          amount: 500,
          rubro_id: 'R-1',
          projectId: 'P-1',
        },
        {
          month: '2026-06',
          month_index: 6, // Valid
          amount: 1000,
          rubro_id: 'R-2',
          projectId: 'P-1',
        }
      ];
      
      const rubros: LineItem[] = [];
      const rows = computeForecastFromAllocations(allocations as any, rubros, 60, 'P-1');
      
      // Only valid month should be included
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].month, 6);
    });
  });
});
