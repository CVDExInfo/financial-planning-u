/**
 * Test for new canonical aliases added to fix console warnings
 */

import { describe, it, expect } from 'vitest';
import { getCanonicalRubroId, LEGACY_RUBRO_ID_MAP, LABOR_CANONICAL_KEYS_SET } from '../canonical-taxonomy';
import { normalizeKey } from '../normalize-key';

describe('Canonical Aliases - Console Warning Fixes', () => {
  it('should map mod-pm-project-manager to MOD-LEAD', () => {
    expect(getCanonicalRubroId('mod-pm-project-manager')).toBe('MOD-LEAD');
  });

  it('should map tec-hw-rpl-equipos-y-tecnolog-a to TEC-HW-RPL', () => {
    expect(getCanonicalRubroId('tec-hw-rpl-equipos-y-tecnolog-a')).toBe('TEC-HW-RPL');
  });

  it('should map tec-itsm-equipos-y-tecnolog-a to TEC-ITSM', () => {
    expect(getCanonicalRubroId('tec-itsm-equipos-y-tecnolog-a')).toBe('TEC-ITSM');
  });

  it('should map inf-cloud-infraestructura-nube-data-center to INF-CLOUD', () => {
    expect(getCanonicalRubroId('inf-cloud-infraestructura-nube-data-center')).toBe('INF-CLOUD');
  });

  it('should map inf-rack-infraestructura-nube-data-center to INF-RACK', () => {
    expect(getCanonicalRubroId('inf-rack-infraestructura-nube-data-center')).toBe('INF-RACK');
  });

  it('should include mod-pm in labor canonical keys', () => {
    const normalized = normalizeKey('mod-pm');
    expect(LABOR_CANONICAL_KEYS_SET.has(normalized)).toBe(true);
  });

  it('should include mod-pm-project-manager in labor canonical keys', () => {
    const normalized = normalizeKey('mod-pm-project-manager');
    expect(LABOR_CANONICAL_KEYS_SET.has(normalized)).toBe(true);
  });

  it('should verify all new aliases exist in LEGACY_RUBRO_ID_MAP', () => {
    const newAliases = [
      'mod-pm-project-manager',
      'tec-hw-rpl-equipos-y-tecnolog-a',
      'tec-hw-rpl-equipos-y-tecnologia',
      'tec-itsm-equipos-y-tecnolog-a',
      'tec-itsm-equipos-y-tecnologia',
      'inf-cloud-infraestructura-nube-data-center',
      'inf-rack-infraestructura-nube-data-center',
    ];

    newAliases.forEach(alias => {
      expect(LEGACY_RUBRO_ID_MAP[alias]).toBeDefined();
      expect(LEGACY_RUBRO_ID_MAP[alias]).not.toBe('');
    });
  });
});
