/**
 * Integration test for SDMT Forecast baseline rubros fallback
 * Tests the complete flow: baseline fetch → rubros fetch → fallback to allocations/prefacturas
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { rubrosFromAllocations } from '../../src/features/sdmt/utils/rubrosFromAllocations.js';

describe('SDMT Forecast Rubros Fallback Integration', () => {
  describe('rubrosFromAllocations integration', () => {
    it('should materialize rubros from allocations when API returns empty', () => {
      const allocations = [
        {
          allocation_id: 'alloc-1',
          rubro_id: 'rubro-labor-001',
          project_id: 'proj-123',
          mes: 'M1',
          monto_planeado: 5000,
        },
        {
          allocation_id: 'alloc-2',
          rubro_id: 'rubro-labor-001',
          project_id: 'proj-123',
          mes: 'M2',
          monto_planeado: 5000,
        },
      ];

      const rubros = rubrosFromAllocations(allocations, []);

      assert.ok(rubros, 'rubros should be defined');
      assert.ok(rubros.length > 0, 'should have at least one rubro');
      assert.ok(rubros[0].rubro_id.includes('alloc-'), 'rubro_id should contain alloc- prefix');
      assert.strictEqual(rubros[0].source, 'allocation', 'source should be allocation');
    });

    it('should materialize rubros from prefacturas when allocations empty', () => {
      const prefacturas = [
        {
          prefactura_id: 'pref-1',
          project_id: 'proj-123',
          mes: 'M1',
          monto: 10000,
          descripcion: 'Test prefactura',
        },
      ];

      const rubros = rubrosFromAllocations([], prefacturas);

      assert.ok(rubros, 'rubros should be defined');
      assert.ok(rubros.length > 0, 'should have at least one rubro');
      assert.ok(rubros[0].rubro_id.includes('pref-'), 'rubro_id should contain pref- prefix');
      assert.strictEqual(rubros[0].source, 'prefactura', 'source should be prefactura');
    });

    it('should merge allocations and prefacturas', () => {
      const allocations = [
        {
          allocation_id: 'alloc-1',
          rubro_id: 'rubro-001',
          project_id: 'proj-123',
          mes: 'M1',
          monto_planeado: 5000,
        },
      ];

      const prefacturas = [
        {
          prefactura_id: 'pref-1',
          project_id: 'proj-123',
          mes: 'M2',
          monto: 10000,
          descripcion: 'Test',
        },
      ];

      const rubros = rubrosFromAllocations(allocations, prefacturas);

      assert.ok(rubros, 'rubros should be defined');
      assert.strictEqual(rubros.length, 2, 'should have 2 rubros');
      
      const allocRubro = rubros.find(r => r.source === 'allocation');
      const prefRubro = rubros.find(r => r.source === 'prefactura');
      
      assert.ok(allocRubro, 'should have allocation rubro');
      assert.ok(prefRubro, 'should have prefactura rubro');
    });

    it('should handle empty arrays without errors', () => {
      const rubros = rubrosFromAllocations([], []);

      assert.ok(rubros, 'rubros should be defined');
      assert.ok(Array.isArray(rubros), 'rubros should be an array');
      assert.strictEqual(rubros.length, 0, 'should be empty array');
    });

    it('should sanitize invalid IDs', () => {
      const allocations = [
        {
          allocation_id: 'alloc-1',
          rubro_id: 'rubro@#$%^&*()_001',
          project_id: 'proj-123',
          mes: 'M1',
          monto_planeado: 5000,
        },
      ];

      const rubros = rubrosFromAllocations(allocations, []);

      assert.ok(rubros[0].rubro_id.match(/^alloc-/), 'should have alloc- prefix');
      assert.ok(!rubros[0].rubro_id.match(/[@#$%^&*()]/), 'should not contain special characters');
    });

    it('should support multiple month formats', () => {
      const allocations = [
        {
          allocation_id: 'alloc-1',
          rubro_id: 'rubro-001',
          project_id: 'proj-123',
          mes: 'M1',
          monto_planeado: 1000,
        },
        {
          allocation_id: 'alloc-2',
          rubro_id: 'rubro-002',
          project_id: 'proj-123',
          mes: '2025-02',
          monto_planeado: 2000,
        },
        {
          allocation_id: 'alloc-3',
          rubro_id: 'rubro-003',
          project_id: 'proj-123',
          mes: '3',
          monto_planeado: 3000,
        },
      ];

      const rubros = rubrosFromAllocations(allocations, []);

      assert.ok(rubros.length >= 3, 'should have at least 3 rubros');
      // All rubros should have valid month ranges
      rubros.forEach(rubro => {
        assert.ok(rubro.monthsRange, 'should have monthsRange');
        assert.ok(Array.isArray(rubro.monthsRange), 'monthsRange should be array');
        assert.strictEqual(rubro.monthsRange.length, 2, 'monthsRange should have 2 elements');
      });
    });

    it('should group recurring allocations correctly', () => {
      const allocations = [
        {
          allocation_id: 'alloc-1',
          rubro_id: 'rubro-recurring',
          project_id: 'proj-123',
          mes: 'M1',
          monto_planeado: 5000,
        },
        {
          allocation_id: 'alloc-2',
          rubro_id: 'rubro-recurring',
          project_id: 'proj-123',
          mes: 'M2',
          monto_planeado: 5000,
        },
        {
          allocation_id: 'alloc-3',
          rubro_id: 'rubro-recurring',
          project_id: 'proj-123',
          mes: 'M3',
          monto_planeado: 5000,
        },
      ];

      const rubros = rubrosFromAllocations(allocations, []);

      assert.strictEqual(rubros.length, 1, 'should be grouped into 1 rubro');
      assert.strictEqual(rubros[0].isRecurring, true, 'should be recurring');
      assert.strictEqual(rubros[0].quantity, 3, 'should have quantity 3');
      assert.strictEqual(rubros[0].monthsRange[0], 1, 'should start at month 1');
      assert.strictEqual(rubros[0].monthsRange[1], 3, 'should end at month 3');
    });
  });

  describe('Promise.allSettled behavior', () => {
    it('should handle fulfilled promise with array', async () => {
      const promise = Promise.resolve([{ id: 1 }, { id: 2 }]);
      const results = await Promise.allSettled([promise]);
      
      const value = results[0].status === 'fulfilled' && Array.isArray(results[0].value) 
        ? results[0].value as any[] 
        : [];

      assert.strictEqual(value.length, 2, 'should have 2 elements');
    });

    it('should handle rejected promise gracefully', async () => {
      const promise = Promise.reject(new Error('Network error'));
      const results = await Promise.allSettled([promise]);
      
      const value = results[0].status === 'fulfilled' && Array.isArray(results[0].value) 
        ? results[0].value as any[] 
        : [];

      assert.deepStrictEqual(value, [], 'should be empty array');
    });

    it('should handle non-array fulfilled value', async () => {
      const promise = Promise.resolve('not an array');
      const results = await Promise.allSettled([promise]);
      
      const value = results[0].status === 'fulfilled' && Array.isArray(results[0].value) 
        ? results[0].value as any[] 
        : [];

      assert.deepStrictEqual(value, [], 'should be empty array');
    });

    it('should handle null fulfilled value', async () => {
      const promise = Promise.resolve(null);
      const results = await Promise.allSettled([promise]);
      
      const value = results[0].status === 'fulfilled' && Array.isArray(results[0].value) 
        ? results[0].value as any[] 
        : [];

      assert.deepStrictEqual(value, [], 'should be empty array');
    });
  });

  describe('FTE calculation from baseline', () => {
    it('should compute total FTE from labor_estimates', () => {
      const baseline = {
        labor_estimates: [
          { fte_count: 2 },
          { fte_count: 3 },
          { fte_count: 1.5 },
        ],
      };

      const totalFTE = baseline.labor_estimates.reduce(
        (sum: number, item: any) => sum + Number(item.fte_count || 0), 
        0
      );

      assert.strictEqual(totalFTE, 6.5, 'total should be 6.5');
    });

    it('should handle missing fte_count fields', () => {
      const baseline = {
        labor_estimates: [
          { fte_count: 2 },
          { fte: 3 }, // alternative field name
          {}, // missing field
        ],
      };

      const totalFTE = baseline.labor_estimates.reduce(
        (sum: number, item: any) => sum + Number(item.fte_count || item.fte || 0), 
        0
      );

      assert.strictEqual(totalFTE, 5, 'total should be 5');
    });

    it('should handle empty labor_estimates', () => {
      const baseline = {
        labor_estimates: [],
      };

      const totalFTE = baseline.labor_estimates.reduce(
        (sum: number, item: any) => sum + Number(item.fte_count || 0), 
        0
      );

      assert.strictEqual(totalFTE, 0, 'total should be 0');
    });
  });
});
