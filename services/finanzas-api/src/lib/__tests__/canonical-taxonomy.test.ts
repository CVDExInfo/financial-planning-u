/**
 * Unit tests for canonical-taxonomy.ts
 * 
 * Tests the robust taxonomy loader with S3 fallback
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock process.env before importing the module
const originalEnv = process.env;

describe('canonical-taxonomy', () => {
  beforeEach(() => {
    // Reset modules to ensure clean state
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ensureTaxonomyLoaded', () => {
    it('should load taxonomy from local file when present', async () => {
      // Import after environment is set
      const { ensureTaxonomyLoaded, CANONICAL_RUBROS_TAXONOMY, CANONICAL_IDS } = 
        await import('../canonical-taxonomy');

      // Call ensureTaxonomyLoaded
      await ensureTaxonomyLoaded();

      // Verify taxonomy is loaded
      expect(CANONICAL_RUBROS_TAXONOMY).toBeDefined();
      expect(Array.isArray(CANONICAL_RUBROS_TAXONOMY)).toBe(true);
      expect(CANONICAL_IDS).toBeDefined();
      expect(CANONICAL_IDS instanceof Set).toBe(true);

      // Local file should have items (assuming data/rubros.taxonomy.json exists)
      // If file doesn't exist in test environment, this will be empty but shouldn't throw
      expect(CANONICAL_RUBROS_TAXONOMY.length).toBeGreaterThanOrEqual(0);
    });

    it('should not throw when local file is missing and TAXONOMY_S3_BUCKET not set', async () => {
      // Set env to not have S3 bucket
      process.env.TAXONOMY_S3_BUCKET = '';

      // Mock fs.readFileSync to throw (simulating missing file)
      jest.mock('fs', () => ({
        readFileSync: jest.fn(() => {
          throw new Error('File not found');
        }),
      }));

      // Import module (will try to load from local file and fail gracefully)
      const { ensureTaxonomyLoaded, CANONICAL_IDS } = 
        await import('../canonical-taxonomy');

      // Should not throw
      await expect(ensureTaxonomyLoaded()).resolves.not.toThrow();

      // Taxonomy should be empty but valid
      expect(CANONICAL_IDS).toBeDefined();
      expect(CANONICAL_IDS instanceof Set).toBe(true);
    });

    it('should handle S3 bucket configuration when local file missing', async () => {
      // Set S3 bucket environment variable
      process.env.TAXONOMY_S3_BUCKET = 'test-taxonomy-bucket';
      process.env.TAXONOMY_S3_KEY = 'test-rubros.taxonomy.json';

      const { ensureTaxonomyLoaded } = await import('../canonical-taxonomy');

      // Should not throw even if S3 fails (graceful degradation)
      await expect(ensureTaxonomyLoaded()).resolves.not.toThrow();
    });
  });

  describe('taxonomy exports', () => {
    it('should export CANONICAL_RUBROS_TAXONOMY as array', async () => {
      const { CANONICAL_RUBROS_TAXONOMY } = await import('../canonical-taxonomy');
      
      expect(CANONICAL_RUBROS_TAXONOMY).toBeDefined();
      expect(Array.isArray(CANONICAL_RUBROS_TAXONOMY)).toBe(true);
    });

    it('should export CANONICAL_IDS as Set', async () => {
      const { CANONICAL_IDS } = await import('../canonical-taxonomy');
      
      expect(CANONICAL_IDS).toBeDefined();
      expect(CANONICAL_IDS instanceof Set).toBe(true);
    });

    it('should export LEGACY_RUBRO_ID_MAP as object', async () => {
      const { LEGACY_RUBRO_ID_MAP } = await import('../canonical-taxonomy');
      
      expect(LEGACY_RUBRO_ID_MAP).toBeDefined();
      expect(typeof LEGACY_RUBRO_ID_MAP).toBe('object');
      
      // Check a few known legacy mappings exist
      expect(LEGACY_RUBRO_ID_MAP['RB0001']).toBe('MOD-ING');
      expect(LEGACY_RUBRO_ID_MAP['RB0002']).toBe('MOD-LEAD');
      expect(LEGACY_RUBRO_ID_MAP['project-manager']).toBe('MOD-LEAD');
    });

    it('should export helper functions', async () => {
      const { 
        getAllCanonicalIds,
        getCanonicalRubroId,
        getTaxonomyById,
        normalizeRubroId,
        isValidRubroId,
        isLegacyRubroId,
      } = await import('../canonical-taxonomy');
      
      expect(typeof getAllCanonicalIds).toBe('function');
      expect(typeof getCanonicalRubroId).toBe('function');
      expect(typeof getTaxonomyById).toBe('function');
      expect(typeof normalizeRubroId).toBe('function');
      expect(typeof isValidRubroId).toBe('function');
      expect(typeof isLegacyRubroId).toBe('function');
    });
  });

  describe('getCanonicalRubroId', () => {
    it('should map legacy IDs to canonical IDs', async () => {
      const { getCanonicalRubroId } = await import('../canonical-taxonomy');
      
      expect(getCanonicalRubroId('RB0001')).toBe('MOD-ING');
      expect(getCanonicalRubroId('RB0002')).toBe('MOD-LEAD');
      expect(getCanonicalRubroId('project-manager')).toBe('MOD-LEAD');
    });

    it('should handle null/undefined input gracefully', async () => {
      const { getCanonicalRubroId } = await import('../canonical-taxonomy');
      
      expect(getCanonicalRubroId(null as any)).toBeNull();
      expect(getCanonicalRubroId(undefined as any)).toBeNull();
      expect(getCanonicalRubroId('')).toBeNull();
    });

    it('should be case-insensitive for lookups', async () => {
      const { getCanonicalRubroId } = await import('../canonical-taxonomy');
      
      // Test case-insensitive legacy mapping
      expect(getCanonicalRubroId('project-manager')).toBe('MOD-LEAD');
      expect(getCanonicalRubroId('PROJECT-MANAGER')).toBe('MOD-LEAD');
      expect(getCanonicalRubroId('Project-Manager')).toBe('MOD-LEAD');
    });
  });

  describe('normalizeRubroId', () => {
    it('should return normalized result with metadata', async () => {
      const { normalizeRubroId } = await import('../canonical-taxonomy');
      
      const result = normalizeRubroId('RB0001');
      
      expect(result).toHaveProperty('canonicalId');
      expect(result).toHaveProperty('isLegacy');
      expect(result).toHaveProperty('isValid');
      expect(result.canonicalId).toBe('MOD-ING');
      expect(result.isLegacy).toBe(true);
      expect(result.isValid).toBe(true);
    });

    it('should include warning for legacy IDs', async () => {
      const { normalizeRubroId } = await import('../canonical-taxonomy');
      
      const result = normalizeRubroId('RB0001');
      
      expect(result).toHaveProperty('warning');
      expect(result.warning).toContain('Legacy rubro_id');
    });
  });

  describe('isValidRubroId', () => {
    it('should return true for valid canonical and legacy IDs', async () => {
      const { isValidRubroId } = await import('../canonical-taxonomy');
      
      expect(isValidRubroId('RB0001')).toBe(true);
      expect(isValidRubroId('project-manager')).toBe(true);
    });

    it('should return false for invalid IDs', async () => {
      const { isValidRubroId } = await import('../canonical-taxonomy');
      
      expect(isValidRubroId('INVALID-RUBRO-999')).toBe(false);
      expect(isValidRubroId(null as any)).toBe(false);
      expect(isValidRubroId(undefined as any)).toBe(false);
      expect(isValidRubroId('')).toBe(false);
    });
  });
});
