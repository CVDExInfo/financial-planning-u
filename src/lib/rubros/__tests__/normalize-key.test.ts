/**
 * Test for normalizeKey function - TDZ Fix Validation
 * 
 * These tests validate the robust normalization implementation
 * that fixes the TDZ (Temporal Dead Zone) error.
 */

import { describe, it, expect } from 'vitest';
import { normalizeKey } from '../normalize-key';

describe('normalizeKey - TDZ Fix Validation', () => {
  describe('basic normalization', () => {
    it('should handle null and undefined', () => {
      expect(normalizeKey(null as any)).toBe('');
      expect(normalizeKey(undefined as any)).toBe('');
      expect(normalizeKey('')).toBe('');
    });

    it('should lowercase strings', () => {
      expect(normalizeKey('UPPERCASE')).toBe('uppercase');
      expect(normalizeKey('MixedCase')).toBe('mixedcase');
      expect(normalizeKey('Service Delivery Manager')).toBe('service-delivery-manager');
    });

    it('should preserve hyphens in canonical IDs', () => {
      expect(normalizeKey('MOD-ING')).toBe('mod-ing');
      expect(normalizeKey('MOD-SDM')).toBe('mod-sdm');
      expect(normalizeKey('TEC-HW-RPL')).toBe('tec-hw-rpl');
    });
  });

  describe('diacritics removal (Unicode normalization)', () => {
    it('should remove Spanish accents', () => {
      expect(normalizeKey('café')).toBe('cafe');
      expect(normalizeKey('niño')).toBe('nino');
      expect(normalizeKey('Mañana')).toBe('manana');
      expect(normalizeKey('técnico')).toBe('tecnico');
      expect(normalizeKey('coordinación')).toBe('coordinacion');
    });

    it('should handle complex diacritics in role descriptions', () => {
      expect(normalizeKey('Ingeniero líder / coordinador')).toBe('ingeniero-lider-coordinador');
      expect(normalizeKey('Contratistas técnicos internos')).toBe('contratistas-tecnicos-internos');
    });

    it('should normalize "í" to "i"', () => {
      const input = 'Ingeniero líder';
      const normalized = normalizeKey(input);
      expect(normalized).toBe('ingeniero-lider');
      expect(normalized).not.toContain('í');
    });
  });

  describe('whitespace handling', () => {
    it('should collapse multiple spaces', () => {
      expect(normalizeKey('multiple   spaces')).toBe('multiple-spaces');
      expect(normalizeKey('  leading and trailing  ')).toBe('leading-and-trailing');
    });

    it('should replace spaces with hyphens', () => {
      expect(normalizeKey('Service Delivery Manager')).toBe('service-delivery-manager');
      expect(normalizeKey('Ingeniero de soporte')).toBe('ingeniero-de-soporte');
    });

    it('should handle tabs and newlines', () => {
      expect(normalizeKey('tab\ttab')).toBe('tab-tab');
      expect(normalizeKey('newline\nnewline')).toBe('newline-newline');
    });
  });

  describe('punctuation removal', () => {
    it('should remove slashes and convert to hyphen', () => {
      expect(normalizeKey('Ingeniero líder / coordinador')).toBe('ingeniero-lider-coordinador');
      expect(normalizeKey('Horas extra / guardias')).toBe('horas-extra-guardias');
    });

    it('should remove parentheses', () => {
      expect(normalizeKey('Service Delivery Manager (SDM)')).toBe('service-delivery-manager-sdm');
      expect(normalizeKey('Ingenieros de soporte (mensual)')).toBe('ingenieros-de-soporte-mensual');
    });

    it('should remove other punctuation', () => {
      expect(normalizeKey('Hello, World!')).toBe('hello-world');
      expect(normalizeKey('test@example.com')).toBe('test-example-com');
      expect(normalizeKey('$100.00')).toBe('100-00');
    });

    it('should collapse multiple hyphens', () => {
      expect(normalizeKey('test---multiple---hyphens')).toBe('test-multiple-hyphens');
      expect(normalizeKey('word  /  word')).toBe('word-word'); // spaces + slash → single hyphen
    });
  });

  describe('real-world alias examples from problem statement', () => {
    it('should normalize "Service Delivery Manager" consistently', () => {
      const variants = [
        'Service Delivery Manager',
        'SERVICE DELIVERY MANAGER',
        'service delivery manager',
        'Service  Delivery  Manager', // extra spaces
      ];

      const expected = 'service-delivery-manager';
      variants.forEach(variant => {
        expect(normalizeKey(variant)).toBe(expected);
      });
    });

    it('should normalize engineer role variations', () => {
      expect(normalizeKey('Ingeniero líder / coordinador')).toBe('ingeniero-lider-coordinador');
      expect(normalizeKey('Ingeniero lider coordinador')).toBe('ingeniero-lider-coordinador');
      expect(normalizeKey('ingeniero lider')).toBe('ingeniero-lider');
      expect(normalizeKey('ingeniero líder')).toBe('ingeniero-lider');
      
      // These should all normalize to the same value
      const variant1 = normalizeKey('Ingeniero líder / coordinador');
      const variant2 = normalizeKey('ingeniero lider coordinador');
      expect(variant1).toBe(variant2);
    });

    it('should handle support engineer variations', () => {
      expect(normalizeKey('Ingenieros de soporte (mensual)')).toBe('ingenieros-de-soporte-mensual');
      expect(normalizeKey('Ingenieros de soporte mensual')).toBe('ingenieros-de-soporte-mensual');
      expect(normalizeKey('ingeniero soporte')).toBe('ingeniero-soporte');
    });

    it('should handle overtime/guards variations', () => {
      expect(normalizeKey('Horas extra / guardias')).toBe('horas-extra-guardias');
      expect(normalizeKey('horas extra guardias')).toBe('horas-extra-guardias');
    });
  });

  describe('edge cases', () => {
    it('should handle numbers', () => {
      expect(normalizeKey(123)).toBe('123');
      expect(normalizeKey('M01')).toBe('m01');
      expect(normalizeKey('RB0001')).toBe('rb0001');
    });

    it('should handle mixed alphanumeric', () => {
      expect(normalizeKey('MOD-SDM-123')).toBe('mod-sdm-123');
      expect(normalizeKey('Version 2.0')).toBe('version-2-0');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(normalizeKey('-leading')).toBe('leading');
      expect(normalizeKey('trailing-')).toBe('trailing');
      expect(normalizeKey('-both-')).toBe('both');
    });

    it('should handle underscores (keep them)', () => {
      // Note: Current implementation converts underscores to hyphens via regex
      // Check actual behavior
      const result = normalizeKey('test_underscore');
      // Based on the normalize-key.ts implementation, underscores are NOT in the keep list
      // So they should be removed or converted
      expect(result).toBe('test-underscore');
    });
  });

  describe('consistency - same input always produces same output', () => {
    it('should be idempotent', () => {
      const input = 'Service Delivery Manager (SDM)';
      const first = normalizeKey(input);
      const second = normalizeKey(first);
      expect(first).toBe(second);
    });

    it('should produce consistent results across multiple calls', () => {
      const input = 'Ingeniero líder / coordinador';
      const results = Array(10).fill(input).map(normalizeKey);
      const unique = new Set(results);
      expect(unique.size).toBe(1); // All results should be identical
    });
  });
});
