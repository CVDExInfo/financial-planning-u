/**
 * Unit tests for computeForecastFromAllocations
 * Validates tolerant matching, taxonomy fallback, and month parsing
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeForecastFromAllocations,
  type Allocation,
  type TaxonomyEntry,
} from '../computeForecastFromAllocations';
import type { LineItem } from '@/types/domain';

describe('computeForecastFromAllocations', () => {
  describe('Exact matching by different ID fields', () => {
    it('should match allocation by rubro id field', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'MOD-LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          description: 'Lead Engineer',
          category: 'Mano de Obra Directa',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Lead Engineer');
      assert.strictEqual(cells[0].category, 'Mano de Obra Directa');
      assert.strictEqual(cells[0].forecast, 1000);
      assert.strictEqual(cells[0].line_item_id, 'MOD-LEAD');
    });

    it('should match allocation by line_item_id field in rubro', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 2000,
          rubroId: 'INFRA-SERVER',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'different-id',
          description: 'Server Infrastructure',
          category: 'Infrastructure',
          start_month: 1,
          end_month: 12,
          unit_cost: 500,
          qty: 1,
          currency: 'USD',
        } as any,
      ];
      // Add line_item_id field
      (rubros[0] as any).line_item_id = 'INFRA-SERVER';

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Server Infrastructure');
      assert.strictEqual(cells[0].category, 'Infrastructure');
    });

    it('should match allocation by rubroId field in rubro', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1500,
          rubroId: 'CONSULTING',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'other-id',
          description: 'Consulting Services',
          category: 'Professional Services',
          start_month: 1,
          end_month: 12,
          unit_cost: 1500,
          qty: 1,
          currency: 'USD',
        } as any,
      ];
      // Add rubroId field
      (rubros[0] as any).rubroId = 'CONSULTING';

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Consulting Services');
      assert.strictEqual(cells[0].category, 'Professional Services');
    });
  });

  describe('Case-insensitive and normalized matching', () => {
    it('should match with case differences', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'mod-lead',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          description: 'Lead Engineer',
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Lead Engineer');
      assert.strictEqual(cells[0].category, 'Labor');
    });

    it('should match with underscore vs dash differences', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'MOD_LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          description: 'Lead Engineer',
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Lead Engineer');
    });

    it('should match with space vs dash differences', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'MOD LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          description: 'Lead Engineer',
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Lead Engineer');
    });

    it('should match with combined normalization differences', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'Mod Lead',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD_LEAD',
          description: 'Lead Engineer',
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Lead Engineer');
    });
  });

  describe('Taxonomy fallback', () => {
    it('should use taxonomy when rubro lacks description', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'MOD-LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          // No description
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as any,
      ];

      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-LEAD': {
          description: 'Project Manager (Lead)',
          category: 'Mano de Obra Directa',
        },
      };

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123', taxonomy);

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Project Manager (Lead)');
      assert.strictEqual(cells[0].category, 'Labor'); // Rubro category takes precedence
    });

    it('should use taxonomy when rubro is not found', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'MOD-LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = []; // No matching rubro

      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-LEAD': {
          description: 'Project Manager (Lead)',
          category: 'Mano de Obra Directa',
        },
      };

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123', taxonomy);

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Project Manager (Lead)');
      assert.strictEqual(cells[0].category, 'Mano de Obra Directa');
    });

    it('should fallback to default when neither rubro nor taxonomy have metadata', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'UNKNOWN-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const taxonomy: Record<string, TaxonomyEntry> = {};

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123', taxonomy);

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].description, 'Allocation UNKNOWN-ITEM');
      assert.strictEqual(cells[0].category, 'Allocations');
    });

    it('should use taxonomy entry matched by normalized rubro ID', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'mod-lead',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD_LEAD',
          // No description or category
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as any,
      ];

      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD_LEAD': {
          description: 'Lead from Taxonomy',
          category: 'Labor',
        },
      };

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123', taxonomy);

      assert.strictEqual(cells.length, 1);
      // Should use taxonomy since rubro has no description
      assert.strictEqual(cells[0].description, 'Lead from Taxonomy');
      assert.strictEqual(cells[0].category, 'Labor');
    });
  });

  describe('Month parsing', () => {
    it('should parse month from YYYY-MM format', () => {
      const allocations: Allocation[] = [
        {
          month: '2025-06',
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 6);
    });

    it('should parse month from numeric value', () => {
      const allocations: Allocation[] = [
        {
          month: 7,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 7);
    });

    it('should prioritize month_index over month field', () => {
      const allocations: Allocation[] = [
        {
          month: '2025-01',
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        } as any,
      ];
      // Add month_index which should take precedence
      (allocations[0] as any).month_index = 12;

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 12);
    });

    it('should parse month from monthIndex (camelCase)', () => {
      const allocations: Allocation[] = [
        {
          month: 1, // fallback, but monthIndex should take precedence
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        } as any,
      ];
      // Add monthIndex (camelCase) which should be parsed
      (allocations[0] as any).monthIndex = 6;

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 6);
    });

    it('should parse month from calendar_month field with YYYY-MM format', () => {
      const allocations: Allocation[] = [
        {
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        } as any,
      ];
      // Add calendar_month which should be parsed
      (allocations[0] as any).calendar_month = '2025-06';

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 6);
    });

    it('should parse month from calendarMonthKey field with YYYY-MM format', () => {
      const allocations: Allocation[] = [
        {
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        } as any,
      ];
      // Add calendarMonthKey which should be parsed
      (allocations[0] as any).calendarMonthKey = '2025-09';

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 9);
    });

    it('should parse month from string "6"', () => {
      const allocations: Allocation[] = [
        {
          month: '6',
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 6);
    });

    it('should handle month values up to 60', () => {
      const allocations: Allocation[] = [
        {
          month: 60,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 60, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 60);
    });

    it('should skip allocations with invalid month values', () => {
      const allocations: Allocation[] = [
        {
          month: 0,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
        {
          month: 61,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
        {
          month: 5,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      // Should only create cell for month 5
      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].month, 5);
    });
  });

  describe('Aggregation and edge cases', () => {
    it('should aggregate multiple allocations for same rubro and month', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 500,
          rubroId: 'MOD-LEAD',
          projectId: 'proj-123',
        },
        {
          month: 1,
          amount: 600,
          rubroId: 'MOD-LEAD',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'MOD-LEAD',
          description: 'Lead Engineer',
          category: 'Labor',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as LineItem,
      ];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].forecast, 1100); // 500 + 600
      assert.strictEqual(cells[0].planned, 1100);
    });

    it('should handle empty allocations array', () => {
      const allocations: Allocation[] = [];
      const rubros: LineItem[] = [];

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 0);
    });

    it('should extract project ID from allocation if not provided', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          projectId: 'proj-from-allocation',
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12);

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].projectId, 'proj-from-allocation');
    });

    it('should return empty array if no project ID can be resolved', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'TEST-ITEM',
          // No projectId
        },
      ];

      const rubros: LineItem[] = [];
      const cells = computeForecastFromAllocations(allocations, rubros, 12);

      assert.strictEqual(cells.length, 0);
    });

    it('should set line_item_id to allocation rubroId for source linking', () => {
      const allocations: Allocation[] = [
        {
          month: 1,
          amount: 1000,
          rubroId: 'ORIGINAL-RUBRO-ID',
          projectId: 'proj-123',
        },
      ];

      const rubros: LineItem[] = [
        {
          id: 'different-id',
          description: 'Test Item',
          category: 'Test',
          start_month: 1,
          end_month: 12,
          unit_cost: 1000,
          qty: 1,
          currency: 'USD',
        } as any,
      ];
      (rubros[0] as any).line_item_id = 'ORIGINAL-RUBRO-ID';

      const cells = computeForecastFromAllocations(allocations, rubros, 12, 'proj-123');

      assert.strictEqual(cells.length, 1);
      assert.strictEqual(cells[0].line_item_id, 'ORIGINAL-RUBRO-ID');
      assert.strictEqual(cells[0].rubroId, 'ORIGINAL-RUBRO-ID');
    });
  });
});
