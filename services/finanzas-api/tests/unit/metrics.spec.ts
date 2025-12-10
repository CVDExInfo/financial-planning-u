/**
 * Tests for metrics calculations (labor vs indirect costs)
 */

import { calculateLaborVsIndirect, aggregateLaborVsIndirect } from '../../src/lib/metrics';

describe('calculateLaborVsIndirect', () => {
  it('should calculate labor share correctly when both MOD and indirect costs exist', () => {
    const result = calculateLaborVsIndirect({
      planMOD: 100,
      planIndirect: 50,
    });

    expect(result.laborSharePlan).toBeCloseTo(0.6667, 4); // 100 / (100 + 50) = 0.6667
    expect(result.totalPlan).toBe(150);
    expect(result.planMOD).toBe(100);
    expect(result.planIndirect).toBe(50);
  });

  it('should return 1.0 (100%) when only MOD exists', () => {
    const result = calculateLaborVsIndirect({
      actualMOD: 200,
    });

    expect(result.laborShareActual).toBe(1.0);
    expect(result.totalActual).toBe(200);
  });

  it('should return 0.0 (0%) when only indirect costs exist', () => {
    const result = calculateLaborVsIndirect({
      forecastIndirect: 150,
    });

    expect(result.laborShareForecast).toBe(0.0);
    expect(result.totalForecast).toBe(150);
  });

  it('should return undefined when both MOD and indirect are missing or zero', () => {
    const result = calculateLaborVsIndirect({});

    expect(result.laborSharePlan).toBeUndefined();
    expect(result.laborShareForecast).toBeUndefined();
    expect(result.laborShareActual).toBeUndefined();
    expect(result.totalPlan).toBeUndefined();
    expect(result.totalForecast).toBeUndefined();
    expect(result.totalActual).toBeUndefined();
  });

  it('should handle zero values correctly', () => {
    const result = calculateLaborVsIndirect({
      planMOD: 0,
      planIndirect: 0,
    });

    expect(result.laborSharePlan).toBeUndefined();
    expect(result.totalPlan).toBeUndefined();
  });

  it('should calculate all three kinds independently', () => {
    const result = calculateLaborVsIndirect({
      planMOD: 100,
      planIndirect: 100,
      forecastMOD: 120,
      forecastIndirect: 80,
      actualMOD: 110,
      actualIndirect: 90,
    });

    expect(result.laborSharePlan).toBeCloseTo(0.5, 4); // 100 / 200
    expect(result.laborShareForecast).toBeCloseTo(0.6, 4); // 120 / 200
    expect(result.laborShareActual).toBeCloseTo(0.55, 4); // 110 / 200
    expect(result.totalPlan).toBe(200);
    expect(result.totalForecast).toBe(200);
    expect(result.totalActual).toBe(200);
  });

  it('should use plan indirect for forecast when forecast indirect is missing', () => {
    const result = calculateLaborVsIndirect({
      forecastMOD: 150,
      planIndirect: 50,
    });

    expect(result.laborShareForecast).toBeCloseTo(0.75, 4); // 150 / (150 + 50)
    expect(result.totalForecast).toBe(200);
    expect(result.forecastIndirect).toBe(50); // Fallback to planIndirect
  });
});

describe('aggregateLaborVsIndirect', () => {
  it('should sum multiple metrics correctly', () => {
    const metrics = [
      calculateLaborVsIndirect({ planMOD: 100, planIndirect: 50 }),
      calculateLaborVsIndirect({ planMOD: 200, planIndirect: 100 }),
      calculateLaborVsIndirect({ planMOD: 50, planIndirect: 25 }),
    ];

    const result = aggregateLaborVsIndirect(metrics);

    expect(result.planMOD).toBe(350); // 100 + 200 + 50
    expect(result.planIndirect).toBe(175); // 50 + 100 + 25
    expect(result.totalPlan).toBe(525); // 350 + 175
    expect(result.laborSharePlan).toBeCloseTo(0.6667, 4); // 350 / 525
  });

  it('should handle empty array', () => {
    const result = aggregateLaborVsIndirect([]);

    expect(result.planMOD).toBe(0);
    expect(result.laborSharePlan).toBeUndefined();
  });

  it('should handle metrics with missing values', () => {
    const metrics = [
      calculateLaborVsIndirect({ planMOD: 100 }),
      calculateLaborVsIndirect({ planIndirect: 50 }),
      calculateLaborVsIndirect({ actualMOD: 75, actualIndirect: 25 }),
    ];

    const result = aggregateLaborVsIndirect(metrics);

    expect(result.planMOD).toBe(100);
    expect(result.planIndirect).toBe(50);
    expect(result.actualMOD).toBe(75);
    expect(result.actualIndirect).toBe(25);
  });

  it('should aggregate across all three kinds', () => {
    const metrics = [
      calculateLaborVsIndirect({
        planMOD: 100,
        planIndirect: 50,
        forecastMOD: 110,
        actualMOD: 95,
        actualIndirect: 48,
      }),
      calculateLaborVsIndirect({
        planMOD: 200,
        planIndirect: 100,
        forecastMOD: 220,
        actualMOD: 190,
        actualIndirect: 95,
      }),
    ];

    const result = aggregateLaborVsIndirect(metrics);

    expect(result.planMOD).toBe(300);
    expect(result.planIndirect).toBe(150);
    expect(result.forecastMOD).toBe(330);
    expect(result.forecastIndirect).toBe(150); // Uses plan indirect as fallback
    expect(result.actualMOD).toBe(285);
    expect(result.actualIndirect).toBe(143);
    
    expect(result.laborSharePlan).toBeCloseTo(0.6667, 4);
    expect(result.laborShareForecast).toBeCloseTo(0.6875, 4);
    expect(result.laborShareActual).toBeCloseTo(0.6659, 4);
  });
});
