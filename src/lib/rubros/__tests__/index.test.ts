/**
 * Tests for the unified frontend rubros helper module
 * 
 * This module tests the public API for rubros operations
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { canonicalizeRubroId, rubroDescriptionFor, findRubroByLineaCodigo } from '../index';

describe('canonicalizeRubroId - frontend public API', () => {
  it('should return canonical ID for valid canonical rubro', () => {
    assert.equal(canonicalizeRubroId('MOD-ING'), 'MOD-ING');
    assert.equal(canonicalizeRubroId('MOD-LEAD'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('GSV-REU'), 'GSV-REU');
  });

  it('should map legacy IDs to canonical IDs', () => {
    assert.equal(canonicalizeRubroId('MOD-PM'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('MOD-PMO'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('RB0001'), 'MOD-ING');
  });

  it('should handle human-readable role names', () => {
    assert.equal(canonicalizeRubroId('project-manager'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('Project Manager'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('Service Delivery Manager'), 'MOD-SDM');
  });

  it('should handle category-suffixed patterns', () => {
    assert.equal(
      canonicalizeRubroId('tec-hw-rpl-equipos-y-tecnologia'),
      'TEC-HW-RPL'
    );
    assert.equal(
      canonicalizeRubroId('inf-cloud-infraestructura-nube-data-center'),
      'INF-CLOUD'
    );
  });

  it('should return undefined for empty or missing input', () => {
    assert.equal(canonicalizeRubroId(), undefined);
    assert.equal(canonicalizeRubroId(''), undefined);
  });

  it('should return undefined for unknown rubro', () => {
    assert.equal(canonicalizeRubroId('UNKNOWN-RUBRO'), undefined);
  });

  it('should be case-insensitive for legacy mappings', () => {
    assert.equal(canonicalizeRubroId('mod-pm'), 'MOD-LEAD');
    assert.equal(canonicalizeRubroId('MOD-PM'), 'MOD-LEAD');
  });
});

describe('rubroDescriptionFor - get description for rubro', () => {
  it('should return description for valid canonical rubro', () => {
    const desc = rubroDescriptionFor('MOD-ING');
    assert.ok(desc, 'Description should exist');
    assert.ok(desc.length > 0, 'Description should not be empty');
  });

  it('should return description for legacy rubro ID', () => {
    const desc = rubroDescriptionFor('MOD-PM');
    assert.ok(desc, 'Description should exist for legacy ID');
  });

  it('should return undefined for unknown rubro', () => {
    assert.equal(rubroDescriptionFor('UNKNOWN-RUBRO'), undefined);
  });

  it('should return undefined for empty input', () => {
    assert.equal(rubroDescriptionFor(''), undefined);
    assert.equal(rubroDescriptionFor(), undefined);
  });
});

describe('findRubroByLineaCodigo - find rubro by linea_codigo', () => {
  it('should return rubro for valid canonical ID', () => {
    const rubro = findRubroByLineaCodigo('MOD-ING');
    assert.ok(rubro, 'Rubro should exist');
    assert.equal(rubro?.linea_codigo, 'MOD-ING');
  });

  it('should return rubro for legacy ID', () => {
    const rubro = findRubroByLineaCodigo('MOD-PM');
    assert.ok(rubro, 'Rubro should exist for legacy ID');
    assert.equal(rubro?.linea_codigo, 'MOD-LEAD', 'Should map to canonical ID');
  });

  it('should return null for unknown rubro', () => {
    assert.equal(findRubroByLineaCodigo('UNKNOWN-RUBRO'), null);
  });

  it('should return null for empty input', () => {
    assert.equal(findRubroByLineaCodigo(''), null);
    assert.equal(findRubroByLineaCodigo(), null);
  });
});
