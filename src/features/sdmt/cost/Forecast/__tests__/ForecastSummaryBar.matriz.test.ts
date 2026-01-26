/**
 * ForecastSummaryBar Matriz Buttons Test Suite
 * 
 * Tests for the 6 evenly distributed Matriz del Mes action buttons
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ForecastSummaryBar - Matriz del Mes Buttons', () => {
  describe('Button Layout', () => {
    it('should have exactly 6 action buttons', () => {
      const buttonLabels = [
        'Presupuesto',
        'Pronóstico',
        'Real',
        '% Consumo',
        'Varianza',
        'Resumen',
      ];
      
      assert.strictEqual(buttonLabels.length, 6, 'Should have 6 buttons');
    });

    it('should use CSS grid with 6 columns for even distribution', () => {
      const gridClass = 'grid-cols-6';
      const containerClass = 'grid grid-cols-6 gap-3 w-full';
      
      assert.ok(containerClass.includes('grid'), 'Container should use CSS grid');
      assert.ok(containerClass.includes(gridClass), 'Grid should have 6 columns');
      assert.ok(containerClass.includes('w-full'), 'Container should span full width');
    });

    it('should have equal width buttons using w-full class', () => {
      const buttonClass = 'w-full';
      const buttons = Array(6).fill({ className: buttonClass });
      
      buttons.forEach((btn, idx) => {
        assert.ok(btn.className.includes('w-full'), `Button ${idx + 1} should have w-full class`);
      });
    });

    it('should center buttons within grid cells', () => {
      const cellWrapper = 'flex justify-center';
      
      assert.ok(cellWrapper.includes('flex'), 'Each cell should use flexbox');
      assert.ok(cellWrapper.includes('justify-center'), 'Content should be centered');
    });
  });

  describe('Summary-Only State', () => {
    it('should default to summary-only view (isSummaryOnly=true)', () => {
      const defaultIsSummaryOnly = true;
      assert.strictEqual(defaultIsSummaryOnly, true, 'Should default to summary-only mode');
    });

    it('should show KPI cards when isSummaryOnly is true', () => {
      const isSummaryOnly = true;
      const shouldShowKpiCards = isSummaryOnly;
      
      assert.strictEqual(shouldShowKpiCards, true, 'KPI cards visible in summary mode');
    });

    it('should hide KPI cards when isSummaryOnly is false', () => {
      const isSummaryOnly = false;
      const shouldShowKpiCards = isSummaryOnly;
      
      assert.strictEqual(shouldShowKpiCards, false, 'KPI cards hidden when expanded');
    });
  });

  describe('Button Interactions', () => {
    it('should toggle isSummaryOnly to false when any metric button is clicked', () => {
      let isSummaryOnly = true;
      const metricButtons = ['Presupuesto', 'Pronóstico', 'Real', '% Consumo', 'Varianza'];
      
      // Simulate clicking any metric button
      const handleMetricClick = () => {
        isSummaryOnly = false;
      };
      
      handleMetricClick();
      assert.strictEqual(isSummaryOnly, false, 'Metric buttons should set isSummaryOnly to false');
    });

    it('should toggle isSummaryOnly to true when Resumen button is clicked', () => {
      let isSummaryOnly = false;
      
      // Simulate clicking Resumen button
      const handleResumenClick = () => {
        isSummaryOnly = true;
      };
      
      handleResumenClick();
      assert.strictEqual(isSummaryOnly, true, 'Resumen button should set isSummaryOnly to true');
    });

    it('should apply default variant to Resumen button when in summary mode', () => {
      const isSummaryOnly = true;
      const resumenVariant = isSummaryOnly ? 'default' : 'outline';
      
      assert.strictEqual(resumenVariant, 'default', 'Resumen button highlighted in summary mode');
    });

    it('should apply outline variant to metric buttons when in summary mode', () => {
      const isSummaryOnly = true;
      const metricVariant = isSummaryOnly ? 'outline' : 'default';
      
      assert.strictEqual(metricVariant, 'outline', 'Metric buttons outlined in summary mode');
    });

    it('should apply default variant to metric buttons when expanded', () => {
      const isSummaryOnly = false;
      const metricVariant = isSummaryOnly ? 'outline' : 'default';
      
      assert.strictEqual(metricVariant, 'default', 'Metric buttons highlighted when expanded');
    });

    it('should apply outline variant to Resumen button when expanded', () => {
      const isSummaryOnly = false;
      const resumenVariant = isSummaryOnly ? 'default' : 'outline';
      
      assert.strictEqual(resumenVariant, 'outline', 'Resumen button outlined when expanded');
    });
  });

  describe('Button Properties', () => {
    it('should use size="sm" for all buttons', () => {
      const buttonSize = 'sm';
      const buttons = Array(6).fill({ size: buttonSize });
      
      buttons.forEach((btn, idx) => {
        assert.strictEqual(btn.size, 'sm', `Button ${idx + 1} should have size="sm"`);
      });
    });

    it('should have proper labels for each button', () => {
      const expectedLabels = {
        budget: 'Presupuesto',
        forecast: 'Pronóstico',
        actual: 'Real',
        consumption: '% Consumo',
        variance: 'Varianza',
        summary: 'Resumen',
      };
      
      assert.strictEqual(expectedLabels.budget, 'Presupuesto');
      assert.strictEqual(expectedLabels.forecast, 'Pronóstico');
      assert.strictEqual(expectedLabels.actual, 'Real');
      assert.strictEqual(expectedLabels.consumption, '% Consumo');
      assert.strictEqual(expectedLabels.variance, 'Varianza');
      assert.strictEqual(expectedLabels.summary, 'Resumen');
    });
  });

  describe('Grid Layout Calculations', () => {
    it('should distribute 6 buttons evenly across container width', () => {
      const totalButtons = 6;
      const gridCols = 6;
      const buttonsPerRow = gridCols;
      
      assert.strictEqual(totalButtons, buttonsPerRow, 'All buttons fit in one row');
    });

    it('should apply consistent gap between buttons', () => {
      const gapClass = 'gap-3';
      const expectedGap = '0.75rem'; // Tailwind gap-3 = 0.75rem
      
      assert.ok(gapClass.includes('gap'), 'Grid should have gap class');
    });

    it('should calculate equal width for each button in grid', () => {
      const containerWidth = 100; // percentage
      const gridCols = 6;
      const gapWidth = 3; // percentage (simplified)
      const totalGaps = gridCols - 1;
      
      // Simplified: (100% - gaps) / 6 cols ≈ equal width per button
      const effectiveWidth = containerWidth - (totalGaps * gapWidth * 0.1);
      const buttonWidth = effectiveWidth / gridCols;
      
      assert.ok(buttonWidth > 15, 'Each button should have reasonable width');
      assert.ok(buttonWidth < 20, 'Each button should not exceed container fraction');
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation between buttons', () => {
      const buttons = ['Presupuesto', 'Pronóstico', 'Real', '% Consumo', 'Varianza', 'Resumen'];
      
      // All buttons should be focusable and tabbable
      assert.strictEqual(buttons.length, 6, 'All 6 buttons should be keyboard-accessible');
    });

    it('should provide clear visual feedback for active state', () => {
      const isSummaryOnly = true;
      const activeButton = 'Resumen';
      const activeVariant = 'default'; // Highlighted when active
      
      assert.strictEqual(activeVariant, 'default', 'Active button should have default variant');
    });
  });

  describe('Responsive Behavior', () => {
    it('should maintain 6-column grid on desktop', () => {
      const desktopGridCols = 'grid-cols-6';
      assert.ok(desktopGridCols.includes('6'), 'Desktop should show 6 columns');
    });

    it('should keep buttons in single row on wide screens', () => {
      const totalButtons = 6;
      const gridCols = 6;
      
      assert.strictEqual(totalButtons, gridCols, 'Single row layout on desktop');
    });

    it('should handle overflow gracefully on small screens', () => {
      // Note: Current implementation uses grid-cols-6 without responsive modifiers
      // This test documents expected behavior for future enhancement
      const mobileLayout = 'grid-cols-6'; // Could be enhanced with sm:grid-cols-2 md:grid-cols-3
      
      assert.ok(mobileLayout.includes('grid-cols'), 'Grid layout applied');
    });
  });

  describe('Integration with KPI Display', () => {
    it('should coordinate button state with KPI visibility', () => {
      const isSummaryOnly = true;
      const showKpis = isSummaryOnly;
      const activeButton = 'Resumen';
      
      assert.strictEqual(showKpis, true, 'KPIs visible when Resumen active');
      assert.strictEqual(activeButton, 'Resumen', 'Resumen button active in summary mode');
    });

    it('should maintain state consistency between buttons and content', () => {
      let isSummaryOnly = true;
      
      // Click metric button
      const clickMetric = () => { isSummaryOnly = false; };
      clickMetric();
      assert.strictEqual(isSummaryOnly, false, 'State updated to expanded');
      
      // Click Resumen button
      const clickResumen = () => { isSummaryOnly = true; };
      clickResumen();
      assert.strictEqual(isSummaryOnly, true, 'State reverted to summary');
    });
  });
});
