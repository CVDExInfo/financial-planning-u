/**
 * Unit tests for rubrosFromAllocations utility
 * Tests allocation mapping, prefactura mapping, merging, and edge cases
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAllocationsToRubros,
  mapPrefacturasToRubros,
  rubrosFromAllocations,
  type Allocation,
  type Prefactura,
  type Rubro,
} from '../rubrosFromAllocations';

describe('mapAllocationsToRubros', () => {
  it('should map single allocation to rubro', () => {
    const allocations: Allocation[] = [
      {
        allocation_id: 'alloc-1',
        rubro_id: 'MOD-ING',
        mes: 'M1',
        monto_planeado: 5000,
      },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.equal(result[0].rubro_id, 'alloc-MOD-ING');
    assert.equal(result[0].nombre, 'MOD-ING');
    assert.equal(result[0].categoria, 'Allocation');
    assert.equal(result[0].source, 'allocation');
    assert.equal(result[0].unitCost, 5000);
    assert.equal(result[0].quantity, 1);
    assert.equal(result[0].isRecurring, false);
    assert.deepEqual(result[0].monthsRange, [1, 1]);
  });

  it('should group multiple allocations by rubro_id', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
      { allocation_id: 'alloc-3', rubro_id: 'MOD-ING', mes: 'M3', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.equal(result[0].rubro_id, 'alloc-MOD-ING');
    assert.equal(result[0].quantity, 3);
    assert.equal(result[0].isRecurring, true);
    assert.equal(result[0].tipo_ejecucion, 'mensual');
    assert.deepEqual(result[0].monthsRange, [1, 3]);
    assert.equal(result[0].unitCost, 5000); // Average per month
  });

  it('should handle multiple different rubros', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'GSV-REU', mes: 'M1', monto_planeado: 2000 },
      { allocation_id: 'alloc-3', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 2);
    
    const modIng = result.find(r => r.rubro_id === 'alloc-MOD-ING');
    assert.ok(modIng);
    assert.equal(modIng.quantity, 2);
    assert.equal(modIng.isRecurring, true);

    const gsvReu = result.find(r => r.rubro_id === 'alloc-GSV-REU');
    assert.ok(gsvReu);
    assert.equal(gsvReu.quantity, 1);
    assert.equal(gsvReu.isRecurring, false);
  });

  it('should parse month format "M1", "M12"', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M12', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].monthsRange, [1, 12]);
  });

  it('should parse month format "YYYY-MM"', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: '2025-01', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: '2025-06', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].monthsRange, [1, 6]);
  });

  it('should handle empty allocations array', () => {
    const result = mapAllocationsToRubros([]);
    assert.equal(result.length, 0);
  });

  it('should skip allocations without rubro_id', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: '', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.equal(result[0].rubro_id, 'alloc-MOD-ING');
  });

  it('should handle varying amounts across months', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 3000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
      { allocation_id: 'alloc-3', rubro_id: 'MOD-ING', mes: 'M3', monto_planeado: 7000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.equal(result[0].unitCost, 5000); // Average: (3000 + 5000 + 7000) / 3
  });
});

describe('mapPrefacturasToRubros', () => {
  it('should map single prefactura to rubro', () => {
    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        rubro_id: 'GSV-REU',
        descripcion: 'Reunión mensual',
        monto: 2000,
        mes: 'M1',
        tipo: 'Gastos de Servicio',
      },
    ];

    const result = mapPrefacturasToRubros(prefacturas);

    assert.equal(result.length, 1);
    assert.equal(result[0].rubro_id, 'pref-pref-1');
    assert.equal(result[0].nombre, 'Reunión mensual');
    assert.equal(result[0].categoria, 'Gastos de Servicio');
    assert.equal(result[0].source, 'prefactura');
    assert.equal(result[0].unitCost, 2000);
    assert.equal(result[0].quantity, 1);
    assert.equal(result[0].isRecurring, false);
    assert.equal(result[0].tipo_ejecucion, 'puntual');
  });

  it('should map multiple prefacturas', () => {
    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        descripcion: 'AWS Cloud',
        monto: 1500,
        mes: 'M1',
        tipo: 'Software',
      },
      {
        prefactura_id: 'pref-2',
        descripcion: 'Office Rent',
        monto: 3000,
        mes: 'M1',
        tipo: 'Facilities',
      },
    ];

    const result = mapPrefacturasToRubros(prefacturas);

    assert.equal(result.length, 2);
    assert.equal(result[0].rubro_id, 'pref-pref-1');
    assert.equal(result[1].rubro_id, 'pref-pref-2');
  });

  it('should handle empty prefacturas array', () => {
    const result = mapPrefacturasToRubros([]);
    assert.equal(result.length, 0);
  });

  it('should use descripcion as nombre', () => {
    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        descripcion: 'Special Service',
        monto: 1000,
        mes: 'M5',
        tipo: 'Other',
      },
    ];

    const result = mapPrefacturasToRubros(prefacturas);

    assert.equal(result[0].nombre, 'Special Service');
  });

  it('should fallback to prefactura_id if descripcion is empty', () => {
    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-123',
        descripcion: '',
        monto: 1000,
        mes: 'M1',
        tipo: 'Other',
      },
    ];

    const result = mapPrefacturasToRubros(prefacturas);

    assert.equal(result[0].nombre, 'Prefactura pref-123');
  });
});

describe('rubrosFromAllocations', () => {
  it('should merge allocations and prefacturas', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
    ];

    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        descripcion: 'AWS',
        monto: 1500,
        mes: 'M1',
        tipo: 'Software',
      },
    ];

    const result = rubrosFromAllocations(allocations, prefacturas);

    assert.equal(result.length, 2);
    
    const allocRubro = result.find(r => r.source === 'allocation');
    assert.ok(allocRubro);
    assert.equal(allocRubro.rubro_id, 'alloc-MOD-ING');

    const prefRubro = result.find(r => r.source === 'prefactura');
    assert.ok(prefRubro);
    assert.equal(prefRubro.rubro_id, 'pref-pref-1');
  });

  it('should handle empty inputs', () => {
    const result = rubrosFromAllocations([], []);
    assert.equal(result.length, 0);
  });

  it('should handle only allocations', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
    ];

    const result = rubrosFromAllocations(allocations, []);

    assert.equal(result.length, 1);
    assert.equal(result[0].source, 'allocation');
  });

  it('should handle only prefacturas', () => {
    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        descripcion: 'AWS',
        monto: 1500,
        mes: 'M1',
        tipo: 'Software',
      },
    ];

    const result = rubrosFromAllocations([], prefacturas);

    assert.equal(result.length, 1);
    assert.equal(result[0].source, 'prefactura');
  });

  it('should handle complex scenario with multiple rubros', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
      { allocation_id: 'alloc-3', rubro_id: 'MOD-LEAD', mes: 'M1', monto_planeado: 8000 },
      { allocation_id: 'alloc-4', rubro_id: 'GSV-REU', mes: 'M1', monto_planeado: 2000 },
    ];

    const prefacturas: Prefactura[] = [
      {
        prefactura_id: 'pref-1',
        descripcion: 'AWS Cloud',
        monto: 1500,
        mes: 'M1',
        tipo: 'Software',
      },
      {
        prefactura_id: 'pref-2',
        descripcion: 'Office Supplies',
        monto: 500,
        mes: 'M2',
        tipo: 'Facilities',
      },
    ];

    const result = rubrosFromAllocations(allocations, prefacturas);

    assert.equal(result.length, 5); // 3 allocation groups + 2 prefacturas
    
    const allocRubros = result.filter(r => r.source === 'allocation');
    const prefRubros = result.filter(r => r.source === 'prefactura');
    
    assert.equal(allocRubros.length, 3);
    assert.equal(prefRubros.length, 2);
  });
});

describe('Month index parsing edge cases', () => {
  it('should handle months beyond M12', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M39', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].monthsRange, [1, 39]);
  });

  it('should handle numeric string months', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: '1', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: '24', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].monthsRange, [1, 24]);
  });

  it('should handle invalid month formats gracefully', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'invalid', monto_planeado: 5000 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 5000 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    // Only M2 is valid, so range should be [2, 2]
    assert.deepEqual(result[0].monthsRange, [2, 2]);
  });

  it('should handle zero amounts', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 0 },
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2', monto_planeado: 0 },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    assert.equal(result[0].unitCost, 0);
  });

  it('should handle missing monto_planeado', () => {
    const allocations: Allocation[] = [
      { allocation_id: 'alloc-1', rubro_id: 'MOD-ING', mes: 'M1', monto_planeado: 5000 },
      // @ts-expect-error - testing missing field
      { allocation_id: 'alloc-2', rubro_id: 'MOD-ING', mes: 'M2' },
    ];

    const result = mapAllocationsToRubros(allocations);

    assert.equal(result.length, 1);
    // Should still work, treating missing as 0
    assert.ok(result[0].unitCost !== undefined);
  });
});
