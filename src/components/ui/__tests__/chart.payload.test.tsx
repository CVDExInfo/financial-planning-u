/**
 * chart.payload.test.tsx
 * 
 * Tests for chart tooltip payload type handling
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Payload, ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

describe('Chart Tooltip Payload Handling', () => {
  describe('Payload type guard', () => {
    it('should handle unknown payload and cast to Payload array', () => {
      // Simulate the unknown payload from Recharts
      const unknownPayload: unknown = [
        {
          name: 'Series 1',
          value: 100,
          dataKey: 'value1',
          color: '#8884d8',
        },
        {
          name: 'Series 2',
          value: 200,
          dataKey: 'value2',
          color: '#82ca9d',
        },
      ];

      // This is the guard logic from chart.tsx
      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(unknownPayload) 
        ? (unknownPayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.ok(Array.isArray(tooltipPayload), 'Should be an array');
      assert.strictEqual(tooltipPayload.length, 2, 'Should have 2 items');
      assert.strictEqual(tooltipPayload[0].name, 'Series 1', 'First item name should match');
      assert.strictEqual(tooltipPayload[1].value, 200, 'Second item value should match');
    });

    it('should return empty array for non-array payload', () => {
      const unknownPayload: unknown = null;

      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(unknownPayload) 
        ? (unknownPayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.ok(Array.isArray(tooltipPayload), 'Should be an array');
      assert.strictEqual(tooltipPayload.length, 0, 'Should be empty');
    });

    it('should return empty array for undefined payload', () => {
      const unknownPayload: unknown = undefined;

      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(unknownPayload) 
        ? (unknownPayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.ok(Array.isArray(tooltipPayload), 'Should be an array');
      assert.strictEqual(tooltipPayload.length, 0, 'Should be empty');
    });

    it('should handle empty array payload', () => {
      const unknownPayload: unknown = [];

      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(unknownPayload) 
        ? (unknownPayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.ok(Array.isArray(tooltipPayload), 'Should be an array');
      assert.strictEqual(tooltipPayload.length, 0, 'Should be empty');
    });
  });

  describe('Canonical payload structure', () => {
    it('should handle forecast chart payload with canonical fields', () => {
      // Canonical payload structure for forecast charts
      const canonicalPayload: unknown = [
        {
          name: 'Planeado',
          value: 15000,
          dataKey: 'planned',
          color: '#3b82f6',
          payload: {
            month: 1,
            planned: 15000,
            forecast: 16000,
            actual: 14500,
          },
        },
        {
          name: 'Pronóstico',
          value: 16000,
          dataKey: 'forecast',
          color: '#10b981',
          payload: {
            month: 1,
            planned: 15000,
            forecast: 16000,
            actual: 14500,
          },
        },
        {
          name: 'Real',
          value: 14500,
          dataKey: 'actual',
          color: '#f59e0b',
          payload: {
            month: 1,
            planned: 15000,
            forecast: 16000,
            actual: 14500,
          },
        },
      ];

      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(canonicalPayload) 
        ? (canonicalPayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.strictEqual(tooltipPayload.length, 3, 'Should have 3 series');
      assert.strictEqual(tooltipPayload[0].dataKey, 'planned', 'First series should be planned');
      assert.strictEqual(tooltipPayload[1].dataKey, 'forecast', 'Second series should be forecast');
      assert.strictEqual(tooltipPayload[2].dataKey, 'actual', 'Third series should be actual');
      
      // Verify values
      assert.strictEqual(tooltipPayload[0].value, 15000, 'Planned value should match');
      assert.strictEqual(tooltipPayload[1].value, 16000, 'Forecast value should match');
      assert.strictEqual(tooltipPayload[2].value, 14500, 'Actual value should match');
    });

    it('should handle variance chart payload', () => {
      const variancePayload: unknown = [
        {
          name: 'Variación',
          value: 1000,
          dataKey: 'variance',
          color: '#ef4444',
          payload: {
            month: 1,
            variance: 1000,
          },
        },
      ];

      const tooltipPayload: ReadonlyArray<Payload<ValueType, NameType>> = Array.isArray(variancePayload) 
        ? (variancePayload as ReadonlyArray<Payload<ValueType, NameType>>) 
        : [];

      assert.strictEqual(tooltipPayload.length, 1, 'Should have 1 series');
      assert.strictEqual(tooltipPayload[0].dataKey, 'variance', 'Should be variance');
      assert.strictEqual(tooltipPayload[0].value, 1000, 'Variance value should match');
    });
  });
});
