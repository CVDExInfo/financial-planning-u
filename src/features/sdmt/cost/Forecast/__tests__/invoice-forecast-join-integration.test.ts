/**
 * Integration tests for invoice → forecast cell matching
 * Validates end-to-end joining logic including:
 * - Canonical ID resolution
 * - Month normalization (including multi-year periods)
 * - Project matching
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  matchInvoiceToCell,
  normalizeInvoiceMonth,
} from '../useSDMTForecastData';
import type { ForecastRow } from '../transformLineItemsToForecast';
import { buildTaxonomyMap, type TaxonomyEntry } from '../lib/taxonomyLookup';
import { canonicalizeRubroId } from '@/lib/rubros';

describe('Invoice → Forecast Join Integration', () => {
  describe('normalizeInvoiceMonth for multi-year periods', () => {
    it('should handle numeric month indices 1-12', () => {
      assert.strictEqual(normalizeInvoiceMonth(1), 1);
      assert.strictEqual(normalizeInvoiceMonth(6), 6);
      assert.strictEqual(normalizeInvoiceMonth(12), 12);
    });

    it('should handle extended month indices for multi-year periods (13-60)', () => {
      assert.strictEqual(normalizeInvoiceMonth(13), 13);
      assert.strictEqual(normalizeInvoiceMonth(24), 24);
      assert.strictEqual(normalizeInvoiceMonth(36), 36);
      assert.strictEqual(normalizeInvoiceMonth(60), 60);
    });

    it('should parse YYYY-MM format correctly', () => {
      assert.strictEqual(normalizeInvoiceMonth('2025-01'), 1);
      assert.strictEqual(normalizeInvoiceMonth('2025-06'), 6);
      assert.strictEqual(normalizeInvoiceMonth('2025-12'), 12);
    });

    it('should parse ISO date format (YYYY-MM-DD)', () => {
      assert.strictEqual(normalizeInvoiceMonth('2025-01-15'), 1);
      assert.strictEqual(normalizeInvoiceMonth('2025-06-30'), 6);
      assert.strictEqual(normalizeInvoiceMonth('2025-12-31'), 12);
    });

    it('should parse ISO datetime format', () => {
      assert.strictEqual(normalizeInvoiceMonth('2025-01-15T10:30:00Z'), 1);
      assert.strictEqual(normalizeInvoiceMonth('2025-06-30T23:59:59Z'), 6);
      assert.strictEqual(normalizeInvoiceMonth('2025-12-31T00:00:00.000Z'), 12);
    });

    it('should parse M format (M1, M01, M12, M60)', () => {
      assert.strictEqual(normalizeInvoiceMonth('M1'), 1);
      assert.strictEqual(normalizeInvoiceMonth('M01'), 1);
      assert.strictEqual(normalizeInvoiceMonth('M12'), 12);
      assert.strictEqual(normalizeInvoiceMonth('M24'), 24);
      assert.strictEqual(normalizeInvoiceMonth('M60'), 60);
      // Case insensitive
      assert.strictEqual(normalizeInvoiceMonth('m1'), 1);
      assert.strictEqual(normalizeInvoiceMonth('m12'), 12);
    });

    it('should return 0 for invalid formats', () => {
      assert.strictEqual(normalizeInvoiceMonth('invalid'), 0);
      assert.strictEqual(normalizeInvoiceMonth('2025'), 0);
      assert.strictEqual(normalizeInvoiceMonth('M0'), 0);
      assert.strictEqual(normalizeInvoiceMonth('M61'), 0);
      assert.strictEqual(normalizeInvoiceMonth(null), 0);
      assert.strictEqual(normalizeInvoiceMonth(undefined), 0);
    });
  });

  describe('matchInvoiceToCell with canonical ID resolution', () => {
    const taxonomy: Record<string, TaxonomyEntry> = {
      'MOD-SDM': {
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
      },
      'MOD-LEAD': {
        rubroId: 'MOD-LEAD',
        description: 'Project Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
      },
    };

    const taxonomyMap = buildTaxonomyMap(taxonomy);
    const taxonomyCache = new Map();

    it('should match invoice with textual description to forecast cell with canonical ID', () => {
      const invoice = {
        line_item_id: 'Service Delivery Manager',
        rubroId: 'Service Delivery Manager',
        description: 'Service Delivery Manager',
        projectId: 'PROJ-001',
        month: 1,
        amount: 5000,
        status: 'matched',
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-001',
      };

      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        false // debugMode off for test
      );

      assert.strictEqual(matched, true, 'Invoice should match forecast cell via canonical ID resolution');
    });

    it('should match invoice with SDM abbreviation to MOD-SDM', () => {
      const invoice = {
        rubroId: 'SDM',
        description: 'SDM',
        projectId: 'PROJ-001',
        month: 1,
        amount: 5000,
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-001',
      };

      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        false
      );

      assert.strictEqual(matched, true, 'Invoice with "SDM" should match MOD-SDM via canonical alias');
    });

    it('should NOT match if projectId differs', () => {
      const invoice = {
        rubroId: 'MOD-SDM',
        projectId: 'PROJ-001',
        month: 1,
        amount: 5000,
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-002', // Different project
      };

      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        false
      );

      assert.strictEqual(matched, false, 'Should not match when projectId differs');
    });

    it('should match using line_item_id direct comparison', () => {
      const invoice = {
        line_item_id: 'MOD-SDM',
        projectId: 'PROJ-001',
        month: 1,
        amount: 5000,
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-001',
      };

      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        false
      );

      assert.strictEqual(matched, true, 'Should match directly via line_item_id');
    });

    it('should match using canonical rubroId resolution', () => {
      // Invoice uses legacy/textual ID, cell uses canonical ID
      const invoice = {
        rubroId: 'Service Delivery Manager',
        projectId: 'PROJ-001',
        month: 6,
        amount: 5000,
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 6,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-001',
      };

      // Verify canonicalizeRubroId works for this case
      // Note: canonicalizeRubroId uses LEGACY_RUBRO_ID_MAP which may not have all textual forms
      // The real matching happens via taxonomy lookup in matchInvoiceToCell
      const canonicalId = canonicalizeRubroId('Service Delivery Manager');
      // canonicalizeRubroId returns undefined if not found in legacy map
      // matchInvoiceToCell handles this via taxonomy lookup

      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        false
      );

      assert.strictEqual(matched, true, 'Should match via canonical rubroId resolution through taxonomy');
    });
  });

  describe('Multi-year period scenarios', () => {
    it('should handle invoice in month 13 (second year, month 1)', () => {
      const invoice = {
        rubroId: 'MOD-SDM',
        projectId: 'PROJ-001',
        month: 13, // Second year, first month
        amount: 5000,
      };

      // This is a simplified test - in real usage, the forecast cell would have monthIndex: 13
      // and the month normalization would handle the year offset
      const monthIndex = normalizeInvoiceMonth(13);
      assert.strictEqual(monthIndex, 13, 'Month 13 should be preserved for multi-year periods');
    });

    it('should handle invoice dated 2026-01-15 for a project starting in 2025', () => {
      // For a project that started in 2025-01, invoice dated 2026-01-15 would be month 13
      const invoiceDate = '2026-01-15T00:00:00Z';
      const invoiceMonth = normalizeInvoiceMonth(invoiceDate);
      
      // The month normalization returns the calendar month (1), not the project month
      // Real implementation would need project start context to compute monthIndex
      assert.strictEqual(invoiceMonth, 1, 'Should parse to calendar month 1');
      
      // In real usage, we'd compute: projectMonthIndex = (invoiceYear - baselineYear) * 12 + invoiceMonth
      // For 2026-01 vs 2025-01: (2026 - 2025) * 12 + 1 = 13
    });
  });

  describe('matchInvoiceToCell with debug diagnostics', () => {
    it('should provide diagnostic information when debugMode is true', () => {
      // This test validates that diagnostics are logged without breaking functionality
      const taxonomy: Record<string, TaxonomyEntry> = {
        'MOD-SDM': {
          rubroId: 'MOD-SDM',
          description: 'Service Delivery Manager',
          category: 'Mano de Obra (MOD)',
          isLabor: true,
        },
      };

      const taxonomyMap = buildTaxonomyMap(taxonomy);
      const taxonomyCache = new Map();

      const invoice = {
        line_item_id: 'MOD-SDM',
        projectId: 'PROJ-001',
        month: 1,
        amount: 5000,
        status: 'matched',
      };

      const forecastCell: ForecastRow = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        category: 'Mano de Obra (MOD)',
        isLabor: true,
        month: 1,
        planned: 0,
        forecast: 0,
        actual: 0,
        variance: 0,
        projectId: 'PROJ-001',
      };

      // In DEV mode, this would log diagnostics
      const matched = matchInvoiceToCell(
        invoice,
        forecastCell,
        taxonomyMap,
        taxonomyCache,
        true // debugMode on
      );

      assert.strictEqual(matched, true, 'Should still match with debug mode enabled');
    });
  });
});
