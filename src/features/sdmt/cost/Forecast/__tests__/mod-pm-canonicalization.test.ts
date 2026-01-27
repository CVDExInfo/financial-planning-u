/**
 * Test MOD-PM → MOD-LEAD canonicalization
 * 
 * Ensures that MOD-PM (legacy PMO identifier) is correctly mapped to MOD-LEAD
 * in the canonical taxonomy, preventing "Unknown rubro_id" warnings.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalizeRubroId, isValidRubroId } from '@/lib/rubros';
import { matchInvoiceToCell } from '../useSDMTForecastData';

describe('MOD-PM Canonicalization', () => {
  describe('Client-side canonical mapping', () => {
    it('should map MOD-PM to MOD-LEAD', () => {
      const canonical = canonicalizeRubroId('MOD-PM');
      assert.equal(canonical, 'MOD-LEAD', 'MOD-PM should map to MOD-LEAD');
    });

    it('should map MOD-PMO to MOD-LEAD', () => {
      const canonical = canonicalizeRubroId('MOD-PMO');
      assert.equal(canonical, 'MOD-LEAD', 'MOD-PMO should map to MOD-LEAD');
    });

    it('should recognize MOD-PM as valid rubroId', () => {
      assert.equal(isValidRubroId('MOD-PM'), true, 'MOD-PM should be recognized as valid');
    });

    it('should recognize MOD-PMO as valid rubroId', () => {
      assert.equal(isValidRubroId('MOD-PMO'), true, 'MOD-PMO should be recognized as valid');
    });

    it('should preserve MOD-LEAD as canonical', () => {
      const canonical = canonicalizeRubroId('MOD-LEAD');
      assert.equal(canonical, 'MOD-LEAD', 'MOD-LEAD should remain MOD-LEAD');
    });
  });

  describe('Invoice matching with MOD-PM', () => {
    const baseCell = {
      line_item_id: '',
      month: 1,
      planned: 1000,
      forecast: 1000,
      actual: 0,
      variance: 0,
      last_updated: new Date().toISOString(),
      updated_by: 'test-user',
    };

    it('should match invoice with MOD-PM to cell with MOD-LEAD', () => {
      const invoice = {
        line_item_id: 'MOD-PM',
        rubroId: 'MOD-PM',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
      };

      // The matchInvoiceToCell function should canonicalize both sides
      // MOD-PM → MOD-LEAD, so they should match
      assert.equal(
        matchInvoiceToCell(invoice, cell),
        true,
        'Invoice with MOD-PM should match cell with MOD-LEAD via canonicalization'
      );
    });

    it('should match invoice with MOD-PMO to cell with MOD-LEAD', () => {
      const invoice = {
        line_item_id: 'MOD-PMO',
        rubroId: 'MOD-PMO',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
      };

      assert.equal(
        matchInvoiceToCell(invoice, cell),
        true,
        'Invoice with MOD-PMO should match cell with MOD-LEAD via canonicalization'
      );
    });

    it('should match invoice with MOD-LEAD to cell with MOD-PM', () => {
      const invoice = {
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        line_item_id: 'MOD-PM',
        rubroId: 'MOD-PM',
      };

      assert.equal(
        matchInvoiceToCell(invoice, cell),
        true,
        'Invoice with MOD-LEAD should match cell with MOD-PM via canonicalization'
      );
    });

    it('should match different MOD-PM variants to each other', () => {
      const invoice = {
        line_item_id: 'MOD-PM',
        rubroId: 'MOD-PM',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        line_item_id: 'MOD-PMO',
        rubroId: 'MOD-PMO',
      };

      assert.equal(
        matchInvoiceToCell(invoice, cell),
        true,
        'Different MOD-PM variants should match via common canonical MOD-LEAD'
      );
    });
  });

  describe('Project guard with MOD-PM', () => {
    const baseCell = {
      line_item_id: '',
      month: 1,
      planned: 1000,
      forecast: 1000,
      actual: 0,
      variance: 0,
      last_updated: new Date().toISOString(),
      updated_by: 'test-user',
    };

    it('should reject MOD-PM invoice when projectId differs', () => {
      const invoice = {
        projectId: 'PROJ-A',
        line_item_id: 'MOD-PM',
        rubroId: 'MOD-PM',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        projectId: 'PROJ-B',
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
      };

      assert.equal(
        matchInvoiceToCell(invoice, cell),
        false,
        'Even with canonical matching, different projectIds should prevent match'
      );
    });

    it('should accept MOD-PM invoice when projectId matches', () => {
      const invoice = {
        projectId: 'PROJ-A',
        line_item_id: 'MOD-PM',
        rubroId: 'MOD-PM',
        amount: 1200,
      };

      const cell = {
        ...baseCell,
        projectId: 'PROJ-A',
        line_item_id: 'MOD-LEAD',
        rubroId: 'MOD-LEAD',
      };

      assert.equal(
        matchInvoiceToCell(invoice, cell),
        true,
        'With matching projectIds, MOD-PM should match MOD-LEAD'
      );
    });
  });
});
