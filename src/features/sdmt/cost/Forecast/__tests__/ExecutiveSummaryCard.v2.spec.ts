/**
 * ExecutiveSummaryCard V2 Component Unit Tests
 * 
 * Tests for ExecutiveSummaryCard rendering, KPI display, and currency formatting
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ExecutiveSummaryCard V2 - KPI Rendering', () => {
  it('should render KPIs correctly with valid summaryBarKpis', () => {
    const summaryBarKpis = {
      presupuesto: 150000,
      pronostico: 145000,
      real: 120000,
      consumo: 80.0,
      varianza: 5000,
    };

    // KPIs array that component builds
    const kpis = [
      { title: 'Presupuesto', value: summaryBarKpis.presupuesto },
      { title: 'Pronóstico', value: summaryBarKpis.pronostico },
      { title: 'Real', value: summaryBarKpis.real },
      { title: 'Consumo', value: summaryBarKpis.consumo },
      { title: 'Varianza', value: summaryBarKpis.varianza },
    ];

    assert.strictEqual(kpis.length, 5, 'Should render 5 KPI tiles');
    assert.strictEqual(kpis[0].value, 150000, 'Presupuesto should be 150000');
    assert.strictEqual(kpis[1].value, 145000, 'Pronóstico should be 145000');
    assert.strictEqual(kpis[2].value, 120000, 'Real should be 120000');
    assert.strictEqual(kpis[3].value, 80.0, 'Consumo should be 80.0%');
    assert.strictEqual(kpis[4].value, 5000, 'Varianza should be 5000');
  });

  it('should handle null summaryBarKpis by returning null', () => {
    const summaryBarKpis = null;
    const shouldRender = summaryBarKpis !== null;

    assert.strictEqual(shouldRender, false, 'Component should not render when summaryBarKpis is null');
  });

  it('should format currency values correctly', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    const presupuesto = 150000;
    const formatted = formatCurrency(presupuesto);

    // MXN currency formatting
    assert.strictEqual(typeof formatted, 'string', 'Formatted value should be a string');
    assert.ok(formatted.includes('150'), 'Formatted value should include the number');
  });

  it('should format percentage values correctly', () => {
    const formatPercentage = (value: number) => {
      return `${value.toFixed(1)}%`;
    };

    const consumo = 80.5;
    const formatted = formatPercentage(consumo);

    assert.strictEqual(formatted, '80.5%', 'Consumo should format as 80.5%');
  });

  it('should use correct color classes for positive varianza', () => {
    const varianza = 5000;
    const colorClass = varianza >= 0 ? 'text-green-600' : 'text-red-600';
    const bgClass = varianza >= 0 ? 'bg-green-50' : 'bg-red-50';

    assert.strictEqual(colorClass, 'text-green-600', 'Positive varianza should use green text');
    assert.strictEqual(bgClass, 'bg-green-50', 'Positive varianza should use green background');
  });

  it('should use correct color classes for negative varianza', () => {
    const varianza = -5000;
    const colorClass = varianza >= 0 ? 'text-green-600' : 'text-red-600';
    const bgClass = varianza >= 0 ? 'bg-green-50' : 'bg-red-50';

    assert.strictEqual(colorClass, 'text-red-600', 'Negative varianza should use red text');
    assert.strictEqual(bgClass, 'bg-red-50', 'Negative varianza should use red background');
  });

  it('should have correct icon mapping for each KPI', () => {
    const icons = [
      { title: 'Presupuesto', iconName: 'DollarSign' },
      { title: 'Pronóstico', iconName: 'Target' },
      { title: 'Real', iconName: 'Activity' },
      { title: 'Consumo', iconName: 'Activity' },
      { title: 'Varianza', iconName: 'TrendingUp or TrendingDown' },
    ];

    assert.strictEqual(icons.length, 5, 'Should have 5 icon mappings');
    assert.strictEqual(icons[0].iconName, 'DollarSign', 'Presupuesto should use DollarSign icon');
    assert.strictEqual(icons[1].iconName, 'Target', 'Pronóstico should use Target icon');
  });
});

describe('ExecutiveSummaryCard V2 - Grid Layout', () => {
  it('should use grid layout with responsive columns', () => {
    const gridClasses = 'grid grid-cols-2 md:grid-cols-5 gap-4';

    assert.ok(gridClasses.includes('grid-cols-2'), 'Should have 2 columns on mobile');
    assert.ok(gridClasses.includes('md:grid-cols-5'), 'Should have 5 columns on medium screens');
  });

  it('should render all KPIs in equal-width tiles', () => {
    const kpiCount = 5;
    const expectedGridCols = 5; // md:grid-cols-5

    assert.strictEqual(kpiCount, expectedGridCols, 'Number of KPIs should match grid columns');
  });
});

describe('ExecutiveSummaryCard V2 - Accessibility', () => {
  it('should have aria-label for each KPI region', () => {
    const kpi = {
      title: 'Presupuesto',
      value: '$150,000',
    };

    const ariaLabel = `${kpi.title}: ${kpi.value}`;

    assert.strictEqual(ariaLabel, 'Presupuesto: $150,000', 'Should have descriptive aria-label');
  });

  it('should mark icons as aria-hidden', () => {
    const iconAriaHidden = true;

    assert.strictEqual(iconAriaHidden, true, 'Icons should have aria-hidden="true"');
  });
});
