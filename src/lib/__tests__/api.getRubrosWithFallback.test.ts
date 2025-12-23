import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getRubrosWithFallback } from '../api';

// Mock ApiService methods
const mockGetRubros = mock.fn();
const mockGetRubrosSummary = mock.fn();
const mockGetAllocations = mock.fn();
const mockGetPrefacturas = mock.fn();

// Mock the ApiService class
mock.module('../api', () => ({
  ApiService: {
    getRubros: mockGetRubros,
    getRubrosSummary: mockGetRubrosSummary,
    getAllocations: mockGetAllocations,
    getPrefacturas: mockGetPrefacturas,
  },
}));

describe('getRubrosWithFallback', () => {
  beforeEach(() => {
    mockGetRubros.mock.resetCalls();
    mockGetRubrosSummary.mock.resetCalls();
    mockGetAllocations.mock.resetCalls();
    mockGetPrefacturas.mock.resetCalls();
  });

  it('returns rubros when getRubros yields data', async () => {
    const mockRubros = [
      { rubroId: 'R1', description: 'Labor', total: 1000 },
      { rubroId: 'R2', description: 'Materials', total: 500 },
    ];

    mockGetRubros.mock.mockImplementation(() => Promise.resolve(mockRubros));

    const result = await getRubrosWithFallback('P123', 'B456');

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].rubroId, 'R1');
    assert.strictEqual(mockGetRubros.mock.callCount(), 1);
    assert.strictEqual(mockGetRubrosSummary.mock.callCount(), 0);
  });

  it('returns server summary when getRubros returns empty but summary has data', async () => {
    const mockSummary = {
      rubro_summary: [
        { rubroId: 'RS1', description: 'Aggregated Labor', total: 2000, monthly: Array(12).fill(0) },
      ],
    };

    mockGetRubros.mock.mockImplementation(() => Promise.resolve([]));
    mockGetRubrosSummary.mock.mockImplementation(() => Promise.resolve(mockSummary));

    const result = await getRubrosWithFallback('P123', 'B456');

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].rubroId, 'RS1');
    assert.strictEqual(mockGetRubros.mock.callCount(), 1);
    assert.strictEqual(mockGetRubrosSummary.mock.callCount(), 1);
  });

  it('aggregates allocations and prefacturas when both endpoints are empty', async () => {
    const mockAllocations = [
      { rubroId: 'MOD-LEAD', role: 'Lead', description: 'Tech Lead', month: 1, amount: 10000, type: 'labor' },
      { rubroId: 'MOD-LEAD', role: 'Lead', description: 'Tech Lead', month: 2, amount: 10000, type: 'labor' },
    ];

    const mockPrefacturas = [
      {
        items: [
          { rubroId: 'IND-CLOUD', description: 'AWS Cloud', month: 1, amount: 500, type: 'indirect' },
        ],
      },
    ];

    mockGetRubros.mock.mockImplementation(() => Promise.resolve([]));
    mockGetRubrosSummary.mock.mockImplementation(() => Promise.reject(new Error('Not found')));
    mockGetAllocations.mock.mockImplementation(() => Promise.resolve(mockAllocations));
    mockGetPrefacturas.mock.mockImplementation(() => Promise.resolve(mockPrefacturas));

    const result = await getRubrosWithFallback('P123');

    assert.ok(result.length > 0);
    assert.strictEqual(mockGetRubros.mock.callCount(), 1);
    assert.strictEqual(mockGetRubrosSummary.mock.callCount(), 1);
    assert.strictEqual(mockGetAllocations.mock.callCount(), 1);
    assert.strictEqual(mockGetPrefacturas.mock.callCount(), 1);

    // Verify aggregation logic
    const leadRubro = result.find((r) => r.rubroId === 'MOD-LEAD');
    assert.ok(leadRubro);
    assert.strictEqual(leadRubro.total, 20000);
    assert.strictEqual(leadRubro.monthly[0], 10000);
    assert.strictEqual(leadRubro.monthly[1], 10000);
  });

  it('returns empty array on complete failure', async () => {
    mockGetRubros.mock.mockImplementation(() => Promise.reject(new Error('Network error')));

    const result = await getRubrosWithFallback('P123');

    assert.strictEqual(result.length, 0);
  });
});
