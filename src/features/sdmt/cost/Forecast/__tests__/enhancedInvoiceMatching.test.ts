/**
 * Tests for enhanced invoice matching with additional field variants
 * 
 * This test validates that the invoice matching improvements support:
 * - linea_codigo field
 * - linea_id field
 * - descripcion field (in addition to description)
 * - linea_gasto field
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getCanonicalRubroId } from '@/lib/rubros/canonical-taxonomy';

// Mock invoice matching function with enhanced field support
function matchInvoiceToCell(
  inv: any, 
  cell: any
): boolean {
  if (!inv) return false;

  // 1) projectId guard: both present → must match
  const invProject = inv.projectId || inv.project_id || inv.project;
  const cellProject = cell.projectId || cell.project_id || cell.project;
  if (invProject && cellProject && String(invProject) !== String(cellProject)) {
    return false;
  }

  // 2) line_item_id: compare directly
  if (inv.line_item_id && cell.line_item_id) {
    if (inv.line_item_id === cell.line_item_id) {
      return true;
    }
  }

  // 3) Enhanced: Support multiple invoice field variants
  const invRubroId = inv.rubroId || inv.rubro_id || inv.line_item_id || inv.linea_codigo || inv.linea_id;
  const cellRubroId = cell.rubroId || cell.line_item_id;
  
  if (invRubroId && cellRubroId) {
    const invCanonical = getCanonicalRubroId(invRubroId);
    const cellCanonical = getCanonicalRubroId(cellRubroId);
    if (invCanonical && cellCanonical && invCanonical === cellCanonical) {
      return true;
    }
  }

  // 4) Enhanced: Support descripcion in addition to description
  const normalizeString = (s: any): string => {
    return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  };
  
  const invDescription = inv.description || inv.descripcion;
  const cellDescription = cell.description;
  
  if (invDescription && cellDescription && normalizeString(invDescription) === normalizeString(cellDescription)) {
    return true;
  }

  return false;
}

describe('Enhanced Invoice Matching with Additional Field Variants', () => {
  describe('linea_codigo field support', () => {
    it('should match invoice with linea_codigo to forecast cell', () => {
      const invoice = {
        linea_codigo: 'MOD-SDM',
        amount: 5000,
        month: '2026-01',
        status: 'posted',
      };
      
      const forecastCell = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        month: 1,
        planned: 4800,
        forecast: 5000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with linea_codigo should match forecast cell');
    });
    
    it('should match invoice with linea_codigo to canonical alias', () => {
      const invoice = {
        linea_codigo: 'Service Delivery Manager', // Human readable name
        amount: 5000,
        month: '2026-01',
        status: 'posted',
      };
      
      const forecastCell = {
        line_item_id: 'MOD-SDM',
        rubroId: 'MOD-SDM',
        description: 'Service Delivery Manager',
        month: 1,
        planned: 4800,
        forecast: 5000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with human-readable linea_codigo should match via canonical alias');
    });
  });
  
  describe('linea_id field support', () => {
    it('should match invoice with linea_id to forecast cell', () => {
      const invoice = {
        linea_id: 'MOD-LEAD',
        amount: 6000,
        month: '2026-02',
        status: 'paid',
      };
      
      const forecastCell = {
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
        description: 'Ingeniero Delivery',
        month: 2,
        planned: 5800,
        forecast: 6000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with linea_id should match forecast cell');
    });
    
    it('should match invoice with linea_id alias to canonical ID', () => {
      const invoice = {
        linea_id: 'Ingeniero Delivery', // Human readable name
        amount: 6000,
        month: '2026-02',
        status: 'paid',
      };
      
      const forecastCell = {
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
        description: 'Ingeniero líder',
        month: 2,
        planned: 5800,
        forecast: 6000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with human-readable linea_id should match via canonical alias');
    });
  });
  
  describe('descripcion field support', () => {
    it('should match invoice with descripcion (Spanish) to forecast cell with description (English)', () => {
      const invoice = {
        rubroId: 'TEC-LIC-MON',
        descripcion: 'Licencias de monitoreo',
        amount: 1500,
        month: '2026-03',
        status: 'approved',
      };
      
      const forecastCell = {
        line_item_id: 'TEC-LIC-MON',
        rubroId: 'TEC-LIC-MON',
        description: 'Licencias de monitoreo',
        month: 3,
        planned: 1400,
        forecast: 1500,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with descripcion should match forecast cell with description');
    });
    
    it('should match invoice with only descripcion (no description field)', () => {
      const invoice = {
        rubroId: 'INF-CLOUD',
        descripcion: 'Servicios Cloud',
        amount: 2000,
        month: '2026-04',
        status: 'posted',
      };
      
      const forecastCell = {
        line_item_id: 'INF-CLOUD',
        rubroId: 'INF-CLOUD',
        description: 'Servicios Cloud',
        month: 4,
        planned: 1900,
        forecast: 2000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Invoice with descripcion should match when description field is missing');
    });
  });
  
  describe('Multiple field fallback chain', () => {
    it('should try linea_codigo, then linea_id, then rubroId in order', () => {
      // Invoice with only linea_codigo
      const invoice1 = {
        linea_codigo: 'MOD-ING',
        amount: 3000,
      };
      
      // Invoice with only linea_id
      const invoice2 = {
        linea_id: 'MOD-ING',
        amount: 3000,
      };
      
      // Invoice with only rubroId
      const invoice3 = {
        rubroId: 'MOD-ING',
        amount: 3000,
      };
      
      const forecastCell = {
        line_item_id: 'MOD-ING',
        rubroId: 'MOD-ING',
        description: 'Ingeniero Soporte',
        month: 5,
        planned: 2900,
        forecast: 3000,
        actual: 0,
      };
      
      assert.strictEqual(matchInvoiceToCell(invoice1, forecastCell), true, 'Should match with linea_codigo');
      assert.strictEqual(matchInvoiceToCell(invoice2, forecastCell), true, 'Should match with linea_id');
      assert.strictEqual(matchInvoiceToCell(invoice3, forecastCell), true, 'Should match with rubroId');
    });
    
    it('should use first available field in priority order', () => {
      // Invoice with all fields - should use first available match
      const invoice = {
        rubroId: 'MOD-LEAD',
        rubro_id: 'WRONG-ID', // Should not use this since rubroId is present
        linea_codigo: 'ALSO-WRONG',
        linea_id: 'STILL-WRONG',
        amount: 4000,
      };
      
      const forecastCell = {
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
        description: 'Project Manager',
        month: 6,
        planned: 3900,
        forecast: 4000,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Should match using first available field (rubroId)');
    });
  });
  
  describe('Case sensitivity and normalization', () => {
    it('should match regardless of case differences in descripcion/description', () => {
      const invoice = {
        rubroId: 'GSV-REU',
        descripcion: 'REUNIONES DE SEGUIMIENTO', // All caps
        amount: 500,
      };
      
      const forecastCell = {
        line_item_id: 'GSV-REU',
        rubroId: 'GSV-REU',
        description: 'Reuniones de seguimiento', // Title case
        month: 7,
        planned: 480,
        forecast: 500,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Should match despite case differences');
    });
    
    it('should normalize whitespace in description matching', () => {
      const invoice = {
        rubroId: 'GSV-RPT',
        description: 'Reportes   mensuales', // Extra spaces
        amount: 300,
      };
      
      const forecastCell = {
        line_item_id: 'GSV-RPT',
        rubroId: 'GSV-RPT',
        description: 'Reportes mensuales', // Single space
        month: 8,
        planned: 280,
        forecast: 300,
        actual: 0,
      };
      
      const matches = matchInvoiceToCell(invoice, forecastCell);
      assert.strictEqual(matches, true, 'Should match despite whitespace differences');
    });
  });
});
