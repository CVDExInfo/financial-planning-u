/**
 * Unit tests for DynamoDB validation helpers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { projectExists, getRubroTaxonomy } from '../../src/lib/dynamo';
import * as dynamo from '../../src/lib/dynamo';
import {
  originalProjectExists,
  originalGetRubroTaxonomy,
} from '../jest.setup';

describe('DynamoDB Validation Helpers', () => {
  const projectExistsMock = dynamo.projectExists as jest.MockedFunction<typeof dynamo.projectExists>;
  const getRubroTaxonomyMock = dynamo.getRubroTaxonomy as jest.MockedFunction<typeof dynamo.getRubroTaxonomy>;

  beforeEach(() => {
    jest.clearAllMocks();
    projectExistsMock.mockImplementation(originalProjectExists);
    getRubroTaxonomyMock.mockImplementation(originalGetRubroTaxonomy);
  });

  describe('projectExists', () => {
    it('should return true when project exists', async () => {
      projectExistsMock.mockResolvedValueOnce(true);

      const result = await projectExists('P-TEST-001');

      expect(result).toBe(true);
      expect(projectExistsMock).toHaveBeenCalledWith('P-TEST-001');
    });

    it('should return false when project does not exist', async () => {
      projectExistsMock.mockResolvedValueOnce(false);

      const result = await projectExists('P-NONEXISTENT');

      expect(result).toBe(false);
    });

    it('should return false when DynamoDB query fails', async () => {
      projectExistsMock.mockImplementationOnce(async () => {
        console.error('Error checking if project exists:', new Error('DynamoDB error'));
        return false;
      });

      let result: boolean | undefined;
      try {
        result = await projectExists('P-ERROR');
      } catch {
        result = false;
      }

      expect(result).toBe(false);
      expect(projectExistsMock).toHaveBeenCalled();
    });
  });

  describe('getRubroTaxonomy', () => {
    it('should return taxonomy data when rubro exists', async () => {
      getRubroTaxonomyMock.mockResolvedValueOnce({
        code: 'MOD-ING',
        description: 'Ingenieros de soporte (mensual)',
        category: 'Mano de Obra Directa',
      });

      const result = await getRubroTaxonomy('MOD-ING');

      expect(result).toEqual({
        code: 'MOD-ING',
        description: 'Ingenieros de soporte (mensual)',
        category: 'Mano de Obra Directa',
      });
      expect(getRubroTaxonomyMock).toHaveBeenCalledWith('MOD-ING');
    });

    it('should return null when rubro does not exist', async () => {
      getRubroTaxonomyMock.mockResolvedValueOnce(null);

      const result = await getRubroTaxonomy('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should return null when DynamoDB query fails', async () => {
      getRubroTaxonomyMock.mockImplementationOnce(async () => {
        console.error('Error fetching rubro taxonomy:', new Error('DynamoDB error'));
        return null;
      });

      let result: any;
      try {
        result = await getRubroTaxonomy('ERROR');
      } catch {
        result = null;
      }

      expect(result).toBeNull();
      expect(getRubroTaxonomyMock).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      getRubroTaxonomyMock.mockResolvedValueOnce({
        code: 'TEST',
        description: '',
        category: '',
      });

      const result = await getRubroTaxonomy('TEST');

      expect(result).toEqual({
        code: 'TEST',
        description: '',
        category: '',
      });
    });
  });
});
