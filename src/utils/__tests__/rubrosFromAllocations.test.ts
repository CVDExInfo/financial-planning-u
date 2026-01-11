/**
 * Unit tests for rubrosFromAllocations utility
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  rubrosFromAllocations,
  mapAllocationsToRubros,
  mapPrefacturasToRubros,
  type AllocationInput,
  type PrefacturaInput,
} from '../rubrosFromAllocations';

describe('rubrosFromAllocations', () => {
  describe('mapAllocationsToRubros', () => {
    it('should map allocation to rubro model with all fields', () => {
      const allocations: AllocationInput[] = [
        {
          id: 'alloc-001',
          category: 'Mano de Obra Directa',
          role: 'Software Engineer',
          description: 'Senior Full Stack Engineer',
          is_recurring: true,
          fte_count: 2,
          rate: 5000,
          start_month: 1,
          end_month: 12,
          project_id: 'P-001',
          baseline_id: 'B-001',
        },
      ];

      const rubros = mapAllocationsToRubros(allocations);

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].id, 'alloc-alloc-001');
      assert.strictEqual(rubros[0].category, 'Mano de Obra Directa');
      assert.strictEqual(rubros[0].description, 'Software Engineer');
      assert.strictEqual(rubros[0].type, 'Recurrente');
      assert.strictEqual(rubros[0].quantity, 2);
      assert.strictEqual(rubros[0].unitCost, 5000);
      assert.strictEqual(rubros[0].monthsRange, 'M1-M12');
      assert.strictEqual(rubros[0].isRecurring, true);
      assert.strictEqual(rubros[0].source, 'allocation');
      assert.strictEqual(rubros[0].projectId, 'P-001');
      assert.strictEqual(rubros[0].baselineId, 'B-001');
    });

    it('should use defaults for missing fields', () => {
      const allocations: AllocationInput[] = [
        {
          id: 'alloc-002',
        },
      ];

      const rubros = mapAllocationsToRubros(allocations);

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].category, 'Mano de Obra Directa');
      assert.strictEqual(rubros[0].description, 'Labor Resource');
      assert.strictEqual(rubros[0].type, 'Único');
      assert.strictEqual(rubros[0].quantity, 1);
      assert.strictEqual(rubros[0].unitCost, 0);
      assert.strictEqual(rubros[0].monthsRange, 'M1-M12');
      assert.strictEqual(rubros[0].isRecurring, false);
    });

    it('should prefer role over description', () => {
      const allocations: AllocationInput[] = [
        {
          id: 'alloc-003',
          role: 'DevOps Engineer',
          description: 'Some other description',
        },
      ];

      const rubros = mapAllocationsToRubros(allocations);

      assert.strictEqual(rubros[0].description, 'DevOps Engineer');
    });

    it('should handle non-recurring allocations', () => {
      const allocations: AllocationInput[] = [
        {
          id: 'alloc-004',
          is_recurring: false,
        },
      ];

      const rubros = mapAllocationsToRubros(allocations);

      assert.strictEqual(rubros[0].type, 'Único');
      assert.strictEqual(rubros[0].isRecurring, false);
    });
  });

  describe('mapPrefacturasToRubros', () => {
    it('should map prefactura to rubro model with all fields', () => {
      const prefacturas: PrefacturaInput[] = [
        {
          id: 'pref-001',
          category: 'Infrastructure',
          description: 'AWS Cloud Services',
          amount: 10000,
          start_month: 2,
          end_month: 3,
          project_id: 'P-001',
          baseline_id: 'B-001',
        },
      ];

      const rubros = mapPrefacturasToRubros(prefacturas);

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].id, 'pref-pref-001');
      assert.strictEqual(rubros[0].category, 'Infrastructure');
      assert.strictEqual(rubros[0].description, 'AWS Cloud Services');
      assert.strictEqual(rubros[0].type, 'Único');
      assert.strictEqual(rubros[0].quantity, 1);
      assert.strictEqual(rubros[0].unitCost, 10000);
      assert.strictEqual(rubros[0].monthsRange, 'M2-M3');
      assert.strictEqual(rubros[0].isRecurring, false);
      assert.strictEqual(rubros[0].source, 'prefactura');
      assert.strictEqual(rubros[0].projectId, 'P-001');
      assert.strictEqual(rubros[0].baselineId, 'B-001');
    });

    it('should use defaults for missing fields', () => {
      const prefacturas: PrefacturaInput[] = [
        {
          id: 'pref-002',
        },
      ];

      const rubros = mapPrefacturasToRubros(prefacturas);

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].category, 'Gastos Generales');
      assert.strictEqual(rubros[0].description, 'Invoice/Prefactura');
      assert.strictEqual(rubros[0].unitCost, 0);
      assert.strictEqual(rubros[0].monthsRange, 'M1-M1');
    });

    it('should always be non-recurring', () => {
      const prefacturas: PrefacturaInput[] = [
        {
          id: 'pref-003',
        },
      ];

      const rubros = mapPrefacturasToRubros(prefacturas);

      assert.strictEqual(rubros[0].isRecurring, false);
      assert.strictEqual(rubros[0].type, 'Único');
    });
  });

  describe('rubrosFromAllocations (main function)', () => {
    it('should merge allocations and prefacturas', () => {
      const allocations: AllocationInput[] = [
        {
          id: 'alloc-001',
          role: 'Engineer',
          fte_count: 3,
          rate: 6000,
        },
        {
          id: 'alloc-002',
          role: 'Designer',
          fte_count: 1,
          rate: 4500,
        },
      ];

      const prefacturas: PrefacturaInput[] = [
        {
          id: 'pref-001',
          description: 'License',
          amount: 5000,
        },
      ];

      const rubros = rubrosFromAllocations(allocations, prefacturas);

      assert.strictEqual(rubros.length, 3);
      
      // Check allocation rubros
      const allocRubros = rubros.filter(r => r.source === 'allocation');
      assert.strictEqual(allocRubros.length, 2);
      assert.strictEqual(allocRubros[0].description, 'Engineer');
      assert.strictEqual(allocRubros[1].description, 'Designer');
      
      // Check prefactura rubros
      const prefRubros = rubros.filter(r => r.source === 'prefactura');
      assert.strictEqual(prefRubros.length, 1);
      assert.strictEqual(prefRubros[0].description, 'License');
    });

    it('should handle empty allocations', () => {
      const rubros = rubrosFromAllocations([], [
        {
          id: 'pref-001',
          description: 'Invoice',
          amount: 1000,
        },
      ]);

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].source, 'prefactura');
    });

    it('should handle empty prefacturas', () => {
      const rubros = rubrosFromAllocations(
        [
          {
            id: 'alloc-001',
            role: 'Developer',
          },
        ],
        []
      );

      assert.strictEqual(rubros.length, 1);
      assert.strictEqual(rubros[0].source, 'allocation');
    });

    it('should handle both empty arrays', () => {
      const rubros = rubrosFromAllocations([], []);

      assert.strictEqual(rubros.length, 0);
    });

    it('should handle undefined parameters', () => {
      const rubros = rubrosFromAllocations();

      assert.strictEqual(rubros.length, 0);
    });

    it('should preserve unique IDs for each source', () => {
      const allocations: AllocationInput[] = [
        {
          id: '123',
          role: 'Developer',
        },
      ];

      const prefacturas: PrefacturaInput[] = [
        {
          id: '123', // Same ID as allocation
          description: 'Invoice',
        },
      ];

      const rubros = rubrosFromAllocations(allocations, prefacturas);

      assert.strictEqual(rubros.length, 2);
      // IDs should be different because of prefix
      assert.strictEqual(rubros[0].id, 'alloc-123');
      assert.strictEqual(rubros[1].id, 'pref-123');
    });
  });
});
