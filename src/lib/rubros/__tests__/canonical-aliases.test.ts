/**
 * Test for new canonical aliases added to fix console warnings
 */

import { describe, it, expect } from 'vitest';
import { 
  getCanonicalRubroId, 
  LEGACY_RUBRO_ID_MAP, 
  LABOR_CANONICAL_KEYS_SET,
  CANONICAL_ALIASES 
} from '../canonical-taxonomy';
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

  describe('CANONICAL_ALIASES map', () => {
    it('should map "Service Delivery Manager" to MOD-SDM', () => {
      const normalized = normalizeKey('Service Delivery Manager');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-SDM');
    });

    it('should map "Project Manager" to MOD-LEAD', () => {
      const normalized = normalizeKey('Project Manager');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-LEAD');
    });

    it('should map "sdm" to MOD-SDM', () => {
      const normalized = normalizeKey('sdm');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-SDM');
    });

    it('should map "pm" to MOD-LEAD', () => {
      const normalized = normalizeKey('pm');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-LEAD');
    });

    it('should map "Ingeniero Lider" to MOD-LEAD', () => {
      const normalized = normalizeKey('Ingeniero Lider');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-LEAD');
    });

    it('should map "Ingeniero Soporte N1" to MOD-ING', () => {
      const normalized = normalizeKey('Ingeniero Soporte N1');
      expect(CANONICAL_ALIASES[normalized]).toBe('MOD-ING');
    });

    it('should have all keys normalized', () => {
      Object.keys(CANONICAL_ALIASES).forEach(key => {
        const normalized = normalizeKey(key);
        // The key should already be normalized or have a normalized variant
        expect(CANONICAL_ALIASES[normalized]).toBeDefined();
      });
    });
  });
});

describe('New Canonical Aliases for Role Strings', () => {
  it('should have Service Delivery Manager aliases', () => {
    expect(CANONICAL_ALIASES['Service Delivery Manager']).toBe('MOD-SDM');
    expect(CANONICAL_ALIASES['SDM']).toBe('MOD-SDM');
  });

  it('should have Project Manager aliases', () => {
    expect(CANONICAL_ALIASES['Project Manager']).toBe('MOD-LEAD');
    expect(CANONICAL_ALIASES['PM']).toBe('MOD-LEAD');
  });

  it('should have Ingeniero Delivery aliases', () => {
    expect(CANONICAL_ALIASES['Ingeniero Delivery']).toBe('MOD-LEAD');
    expect(CANONICAL_ALIASES['Ingeniero Lider']).toBe('MOD-LEAD');
  });

  it('should have support engineer aliases', () => {
    expect(CANONICAL_ALIASES['Ingeniero Soporte N1']).toBe('MOD-ING');
    expect(CANONICAL_ALIASES['Ingeniero Soporte N2']).toBe('MOD-ING');
    expect(CANONICAL_ALIASES['Ingeniero Soporte N3']).toBe('MOD-ING');
  });

  it('should have all aliases properly normalized when looked up', () => {
    Object.entries(CANONICAL_ALIASES).forEach(([alias, rubroId]) => {
      const normalized = normalizeKey(alias);
      expect(normalized).toBeTruthy();
      expect(rubroId).toBeTruthy();
      expect(rubroId).toMatch(/^[A-Z]{3,4}(-[A-Z]+)?$/); // Should be a valid rubro ID format
    });
  });
});
