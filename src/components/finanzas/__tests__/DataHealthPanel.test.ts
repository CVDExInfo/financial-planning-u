/**
 * DataHealthPanel Tests
 * 
 * Tests for unmapped rubros export functionality
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { LineItem } from '@/types/domain';

// Helper to identify unmapped rubros
export function identifyUnmappedRubros(lineItems: LineItem[]): LineItem[] {
  return lineItems.filter(item => {
    const category = item.category?.trim();
    return !category || category === '' || category.toLowerCase() === 'sin categoría';
  });
}

// Helper to create CSV content for unmapped rubros
export function createUnmappedRubrosCSV(
  unmappedRubros: Array<{
    projectId: string;
    projectName: string;
    rubroId: string;
    rubroDescription: string;
    totalForecast: number;
    totalActual: number;
  }>
): string {
  // Note: totalActual header includes (N/A) to indicate data is not available from line items API
  const headers = ['projectId', 'projectName', 'rubroId', 'rubroDescription', 'totalForecast', 'totalActual (N/A)'];
  const rows = unmappedRubros.map(r => [
    r.projectId,
    r.projectName,
    r.rubroId,
    r.rubroDescription,
    r.totalForecast.toString(),
    r.totalActual.toString(),
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

describe('DataHealthPanel - Unmapped Rubros', () => {
  it('should identify rubros with undefined category', () => {
    const lineItems: Partial<LineItem>[] = [
      { id: 'r1', description: 'Item 1', category: undefined },
      { id: 'r2', description: 'Item 2', category: 'Hardware' },
    ];

    const unmapped = identifyUnmappedRubros(lineItems as LineItem[]);

    assert.strictEqual(unmapped.length, 1);
    assert.strictEqual(unmapped[0].id, 'r1');
  });

  it('should identify rubros with empty category', () => {
    const lineItems: Partial<LineItem>[] = [
      { id: 'r1', description: 'Item 1', category: '' },
      { id: 'r2', description: 'Item 2', category: '   ' }, // whitespace only
      { id: 'r3', description: 'Item 3', category: 'Software' },
    ];

    const unmapped = identifyUnmappedRubros(lineItems as LineItem[]);

    assert.strictEqual(unmapped.length, 2);
  });

  it('should identify rubros with "Sin categoría" category', () => {
    const lineItems: Partial<LineItem>[] = [
      { id: 'r1', description: 'Item 1', category: 'Sin categoría' },
      { id: 'r2', description: 'Item 2', category: 'sin categoría' }, // case insensitive
      { id: 'r3', description: 'Item 3', category: 'Hardware' },
    ];

    const unmapped = identifyUnmappedRubros(lineItems as LineItem[]);

    assert.strictEqual(unmapped.length, 2);
  });

  it('should create CSV with correct headers', () => {
    const unmapped = [
      {
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        rubroId: 'rubro-1',
        rubroDescription: 'Server costs',
        totalForecast: 50000,
        totalActual: 45000,
      },
    ];

    const csv = createUnmappedRubrosCSV(unmapped);
    const lines = csv.split('\n');

    assert.strictEqual(lines[0], 'projectId,projectName,rubroId,rubroDescription,totalForecast,totalActual (N/A)');
  });

  it('should create CSV with correct data rows', () => {
    const unmapped = [
      {
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        rubroId: 'rubro-1',
        rubroDescription: 'Server costs',
        totalForecast: 50000,
        totalActual: 45000,
      },
      {
        projectId: 'proj-2',
        projectName: 'Project Beta',
        rubroId: 'rubro-2',
        rubroDescription: 'Network equipment',
        totalForecast: 30000,
        totalActual: 28000,
      },
    ];

    const csv = createUnmappedRubrosCSV(unmapped);
    const lines = csv.split('\n');

    assert.strictEqual(lines.length, 3); // header + 2 rows
    assert.ok(lines[1].includes('proj-1'));
    assert.ok(lines[1].includes('Project Alpha'));
    assert.ok(lines[1].includes('50000'));
    assert.ok(lines[2].includes('proj-2'));
  });

  it('should handle special characters in CSV fields', () => {
    const unmapped = [
      {
        projectId: 'proj-1',
        projectName: 'Project "Alpha"',
        rubroId: 'rubro-1',
        rubroDescription: 'Server, storage, and networking',
        totalForecast: 50000,
        totalActual: 45000,
      },
    ];

    const csv = createUnmappedRubrosCSV(unmapped);
    
    // Fields should be quoted
    assert.ok(csv.includes('"Project \\"Alpha\\""') || csv.includes('"Project "Alpha""'));
    assert.ok(csv.includes('"Server, storage, and networking"'));
  });

  it('should calculate total forecast for unmapped rubros', () => {
    const unmapped = [
      {
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        rubroId: 'rubro-1',
        rubroDescription: 'Item 1',
        totalForecast: 50000,
        totalActual: 45000,
      },
      {
        projectId: 'proj-1',
        projectName: 'Project Alpha',
        rubroId: 'rubro-2',
        rubroDescription: 'Item 2',
        totalForecast: 30000,
        totalActual: 25000,
      },
    ];

    const totalForecast = unmapped.reduce((sum, r) => sum + r.totalForecast, 0);

    assert.strictEqual(totalForecast, 80000);
  });
});
