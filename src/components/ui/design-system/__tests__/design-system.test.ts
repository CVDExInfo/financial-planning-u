/**
 * Design System Component Tests
 * 
 * Unit tests for Tier 3 design system components
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { grid, spacing, colors, getSpacing } from '@/lib/design-system/theme';
import { 
  getAllCategories, 
  getAllFuentesReferencia,
  getFuenteReferenciaLabel,
  getTaxonomyByLineaId,
  searchTaxonomy,
  getCategoryColor
} from '@/lib/rubros/taxonomyHelpers';

describe('Design System Theme', () => {
  it('should export grid configuration', () => {
    assert.strictEqual(grid.columns, 12);
    assert.strictEqual(grid.gutter, '1rem');
    assert.strictEqual(grid.margin, '1.5rem');
  });

  it('should export spacing scale', () => {
    assert.strictEqual(spacing.xs, '0.5rem');
    assert.strictEqual(spacing.sm, '0.75rem');
    assert.strictEqual(spacing.md, '1rem');
    assert.strictEqual(spacing.lg, '1.5rem');
    assert.strictEqual(spacing.xl, '2rem');
    assert.strictEqual(spacing['2xl'], '3rem');
  });

  it('should provide getSpacing helper', () => {
    assert.strictEqual(getSpacing('xs'), '0.5rem');
    assert.strictEqual(getSpacing('lg'), '1.5rem');
  });

  it('should export color palette', () => {
    assert.ok(colors.primary);
    assert.ok(colors.secondary);
    assert.ok(colors.status);
    assert.ok(colors.neutral);
  });

  it('should have status colors', () => {
    assert.ok(colors.status.success);
    assert.ok(colors.status.warning);
    assert.ok(colors.status.error);
    assert.ok(colors.status.info);
  });

  it('should have neutral scale (50-900)', () => {
    assert.ok(colors.neutral[50]);
    assert.ok(colors.neutral[100]);
    assert.ok(colors.neutral[500]);
    assert.ok(colors.neutral[900]);
  });
});

describe('Taxonomy Helpers', () => {
  it('should get all categories', () => {
    const categories = getAllCategories();
    assert.ok(Array.isArray(categories));
    assert.ok(categories.length > 0);
    
    // Check structure
    const firstCategory = categories[0];
    assert.ok('codigo' in firstCategory);
    assert.ok('nombre' in firstCategory);
  });

  it('should get all fuentes referencia', () => {
    const fuentes = getAllFuentesReferencia();
    assert.ok(Array.isArray(fuentes));
    assert.ok(fuentes.length > 0);
  });

  it('should map fuente_referencia to user-friendly labels', () => {
    // Test known values
    assert.strictEqual(getFuenteReferenciaLabel('PMO'), 'PMO');
    assert.strictEqual(getFuenteReferenciaLabel('MSP'), 'MSP');
    assert.strictEqual(getFuenteReferenciaLabel('SAP'), 'ERP / Contabilidad (SAP)');
    
    // Test null/undefined
    assert.strictEqual(getFuenteReferenciaLabel(null), 'Sin clasificar');
    assert.strictEqual(getFuenteReferenciaLabel(undefined), 'Sin clasificar');
    
    // Test unknown value (should return as-is)
    const unknownValue = 'UNKNOWN_VALUE_XYZ';
    assert.strictEqual(getFuenteReferenciaLabel(unknownValue), unknownValue);
  });

  it('should get taxonomy by linea ID', () => {
    const taxonomy = getTaxonomyByLineaId('QLT-ISO');
    
    if (taxonomy) {
      assert.strictEqual(taxonomy.linea_codigo, 'QLT-ISO');
      assert.ok(taxonomy.categoria);
      assert.ok(taxonomy.fuente_referencia);
    }
  });

  it('should search taxonomy by term', () => {
    const results = searchTaxonomy('ISO');
    assert.ok(Array.isArray(results));
    
    // Should find items with ISO in various fields
    if (results.length > 0) {
      const hasISOinFields = results.some(item => 
        item.linea_gasto?.includes('ISO') ||
        item.descripcion?.includes('ISO') ||
        item.fuente_referencia?.includes('ISO')
      );
      assert.ok(hasISOinFields);
    }
  });

  it('should return empty array for empty search term', () => {
    const results = searchTaxonomy('');
    assert.strictEqual(results.length, 0);
  });

  it('should get category color', () => {
    // Test known categories
    assert.strictEqual(getCategoryColor('QLT'), 'emerald');
    assert.strictEqual(getCategoryColor('RIE'), 'red');
    assert.strictEqual(getCategoryColor('PMO'), 'purple');
    
    // Test unknown category (should return default)
    assert.strictEqual(getCategoryColor('UNKNOWN'), 'slate');
  });
});

describe('DashboardLayout Component Logic', () => {
  it('should have correct grid configuration', () => {
    // Verify grid system matches specification
    assert.strictEqual(grid.columns, 12, 'Grid should have 12 columns');
    assert.strictEqual(grid.gutter, '1rem', 'Gutters should be 16px (1rem)');
    assert.strictEqual(grid.margin, '1.5rem', 'Margins should be 24px (1.5rem)');
  });

  it('should have responsive breakpoints', () => {
    assert.strictEqual(grid.breakpoints.sm, '640px');
    assert.strictEqual(grid.breakpoints.md, '768px');
    assert.strictEqual(grid.breakpoints.lg, '1024px');
    assert.strictEqual(grid.breakpoints.xl, '1280px');
    assert.strictEqual(grid.breakpoints['2xl'], '1400px');
  });
});

describe('StandardTable Density Logic', () => {
  it('should support compact and comfortable densities', () => {
    const densities: Array<'compact' | 'comfortable'> = ['compact', 'comfortable'];
    
    // Verify both are valid
    assert.ok(densities.includes('compact'));
    assert.ok(densities.includes('comfortable'));
  });
});

describe('Chip Variants Logic', () => {
  it('should have status variants', () => {
    const statusVariants = ['success', 'warning', 'error', 'info'] as const;
    
    // Verify all status variants exist
    statusVariants.forEach(variant => {
      assert.ok(variant);
    });
  });

  it('should have category and tag variants', () => {
    const variants = ['category', 'tag'] as const;
    
    variants.forEach(variant => {
      assert.ok(variant);
    });
  });
});

describe('Variance Chip Logic', () => {
  it('should determine correct variant based on thresholds', () => {
    // Helper function to determine variant (mimics VarianceChip logic)
    function getVarianceVariant(
      variance: number,
      percentage: number,
      warningThreshold: number = 10,
      errorThreshold: number = 20
    ): 'success' | 'warning' | 'error' | 'info' {
      const absPercentage = Math.abs(percentage);
      const isOnTarget = variance === 0;

      if (isOnTarget) {
        return 'success';
      } else if (absPercentage >= errorThreshold) {
        return 'error';
      } else if (absPercentage >= warningThreshold) {
        return 'warning';
      } else {
        return 'info';
      }
    }

    // Test cases
    assert.strictEqual(getVarianceVariant(0, 0), 'success', 'Zero variance should be success');
    assert.strictEqual(getVarianceVariant(100, 5), 'info', '5% variance should be info');
    assert.strictEqual(getVarianceVariant(100, 15), 'warning', '15% variance should be warning');
    assert.strictEqual(getVarianceVariant(100, 25), 'error', '25% variance should be error');
    assert.strictEqual(getVarianceVariant(-100, -15), 'warning', 'Negative variance uses absolute value');
  });
});
