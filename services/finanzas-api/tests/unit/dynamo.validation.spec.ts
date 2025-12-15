/**
 * Unit tests for DynamoDB validation helpers
 */

import { projectExists, getRubroTaxonomy } from '../../src/lib/dynamo';
import { GetCommand, ddb } from '../../src/lib/dynamo';

// Mock DynamoDB send method
jest.mock('../../src/lib/dynamo', () => {
  const actual = jest.requireActual('../../src/lib/dynamo');
  return {
    ...actual,
    ddb: {
      send: jest.fn(),
    },
    sendDdb: jest.fn(),
  };
});

describe('DynamoDB Validation Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('projectExists', () => {
    it('should return true when project exists', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockResolvedValueOnce({
        Item: {
          pk: 'PROJECT#P-TEST-001',
          sk: 'META',
          projectId: 'P-TEST-001',
          name: 'Test Project',
        },
      });

      const result = await projectExists('P-TEST-001');
      
      expect(result).toBe(true);
      expect(mockSendDdb).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              pk: 'PROJECT#P-TEST-001',
              sk: 'META',
            },
          }),
        })
      );
    });

    it('should return false when project does not exist', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockResolvedValueOnce({ Item: undefined });

      const result = await projectExists('P-NONEXISTENT');
      
      expect(result).toBe(false);
    });

    it('should return false when DynamoDB query fails', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockRejectedValueOnce(new Error('DynamoDB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await projectExists('P-ERROR');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getRubroTaxonomy', () => {
    it('should return taxonomy data when rubro exists', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockResolvedValueOnce({
        Item: {
          pk: 'TAXONOMY',
          sk: 'RUBRO#MOD-ING',
          linea_codigo: 'MOD-ING',
          linea_gasto: 'Ingenieros de soporte (mensual)',
          categoria: 'Mano de Obra Directa',
          descripcion: 'Costo mensual de ingenieros asignados al servicio',
        },
      });

      const result = await getRubroTaxonomy('MOD-ING');
      
      expect(result).toEqual({
        code: 'MOD-ING',
        description: 'Ingenieros de soporte (mensual)',
        category: 'Mano de Obra Directa',
      });
      expect(mockSendDdb).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Key: {
              pk: 'TAXONOMY',
              sk: 'RUBRO#MOD-ING',
            },
          }),
        })
      );
    });

    it('should return null when rubro does not exist', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockResolvedValueOnce({ Item: undefined });

      const result = await getRubroTaxonomy('NONEXISTENT');
      
      expect(result).toBeNull();
    });

    it('should return null when DynamoDB query fails', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockRejectedValueOnce(new Error('DynamoDB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await getRubroTaxonomy('ERROR');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing optional fields', async () => {
      const mockSendDdb = require('../../src/lib/dynamo').sendDdb;
      mockSendDdb.mockResolvedValueOnce({
        Item: {
          pk: 'TAXONOMY',
          sk: 'RUBRO#TEST',
          linea_codigo: 'TEST',
        },
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
