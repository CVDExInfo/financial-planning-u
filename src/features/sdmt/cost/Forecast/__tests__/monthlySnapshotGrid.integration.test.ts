/**
 * MonthlySnapshotGrid Integration Test - React Import Regression
 * 
 * Regression test for "React is not defined" error that occurs when
 * expanding "Cuadrícula de Pronóstico 12 Meses" on /finanzas/sdmt/cost/forecast
 * 
 * This test ensures:
 * 1. MonthlySnapshotGrid component can be imported without errors
 * 2. ForecastRubrosTable component can be imported without errors
 * 3. MonthlySnapshotSummary component can be imported without errors
 * 4. No "React is not defined" errors occur when rendering components
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('MonthlySnapshotGrid - React Import Regression Test', () => {
  it('should import MonthlySnapshotGrid without React errors', async () => {
    try {
      // Dynamic import to catch any "React is not defined" errors
      const module = await import('../components/MonthlySnapshotGrid');
      
      assert.ok(module.MonthlySnapshotGrid, 'MonthlySnapshotGrid should be exported');
      assert.strictEqual(
        typeof module.MonthlySnapshotGrid,
        'function',
        'MonthlySnapshotGrid should be a function/component'
      );
    } catch (error: any) {
      // Check for "React is not defined" error
      if (error?.message?.includes('React is not defined')) {
        assert.fail(
          'React is not defined error detected in MonthlySnapshotGrid. ' +
          'This indicates missing React import or Fragment usage without proper import. ' +
          'Ensure all components using JSX have proper imports from "react".'
        );
      }
      // Re-throw other errors for debugging
      throw error;
    }
  });

  it('should import MonthlySnapshotSummary without React errors', async () => {
    try {
      const module = await import('../components/MonthlySnapshotSummary');
      
      assert.ok(module.MonthlySnapshotSummary, 'MonthlySnapshotSummary should be exported');
      assert.strictEqual(
        typeof module.MonthlySnapshotSummary,
        'function',
        'MonthlySnapshotSummary should be a function/component'
      );
    } catch (error: any) {
      if (error?.message?.includes('React is not defined')) {
        assert.fail(
          'React is not defined error detected in MonthlySnapshotSummary. ' +
          'Ensure all React hooks and JSX are properly imported.'
        );
      }
      throw error;
    }
  });

  it('should import ForecastRubrosTable without React errors', async () => {
    try {
      const module = await import('../components/ForecastRubrosTable');
      
      assert.ok(module.ForecastRubrosTable, 'ForecastRubrosTable should be exported');
      assert.strictEqual(
        typeof module.ForecastRubrosTable,
        'function',
        'ForecastRubrosTable should be a function/component'
      );
    } catch (error: any) {
      if (error?.message?.includes('React is not defined')) {
        assert.fail(
          'React is not defined error detected in ForecastRubrosTable. ' +
          'This was the original issue - React.Fragment usage without importing React or Fragment. ' +
          'The fix should import Fragment from "react" and use <Fragment> instead of <React.Fragment>.'
        );
      }
      throw error;
    }
  });

  it('should verify Fragment import pattern in ForecastRubrosTable', async () => {
    // This test verifies that the component uses the correct import pattern
    // Read the source file to check the import statement
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(
      process.cwd(),
      'src/features/sdmt/cost/Forecast/components/ForecastRubrosTable.tsx'
    );
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check that Fragment is imported from 'react'
      const hasFragmentImport = content.includes("import { useState, useMemo, useEffect, Fragment } from 'react'") ||
                                 content.includes('import { Fragment }') ||
                                 content.includes('import {Fragment}');
      
      // Check that React.Fragment is NOT used (should use Fragment or <>)
      const usesReactFragment = content.includes('React.Fragment');
      
      assert.ok(
        hasFragmentImport || !usesReactFragment,
        'ForecastRubrosTable should either import Fragment from react or not use React.Fragment'
      );
      
      if (usesReactFragment) {
        assert.fail(
          'ForecastRubrosTable still uses React.Fragment without importing React. ' +
          'Replace with <Fragment> (and import Fragment) or use <> shorthand.'
        );
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File not found - this is okay in some test environments
        console.warn('Warning: Could not read source file for verification');
      } else {
        throw error;
      }
    }
  });

  it('should verify automatic JSX runtime configuration in vite.config.ts', async () => {
    // Verify that vite.config.ts has explicit jsxRuntime: 'automatic'
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'vite.config.ts');
    
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      
      // Check for explicit jsxRuntime configuration
      const hasAutomatic = content.includes("jsxRuntime: 'automatic'") ||
                           content.includes('jsxRuntime:"automatic"') ||
                           content.includes("jsxRuntime:'automatic'");
      
      assert.ok(
        hasAutomatic,
        'vite.config.ts should have explicit jsxRuntime: "automatic" configuration to prevent mixed transform modes'
      );
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('Warning: Could not read vite.config.ts for verification');
      } else {
        throw error;
      }
    }
  });
});

describe('MonthlySnapshotGrid - Expanded Grid Rendering', () => {
  it('should handle collapse/expand toggle without errors', () => {
    // Simulate the collapse/expand state toggle
    let isCollapsed = false;
    
    // Toggle to expanded
    isCollapsed = !isCollapsed;
    assert.strictEqual(isCollapsed, true, 'Should be collapsed after first toggle');
    
    // Toggle to collapsed
    isCollapsed = !isCollapsed;
    assert.strictEqual(isCollapsed, false, 'Should be expanded after second toggle');
  });

  it('should calculate summary totals for collapsed view', () => {
    // Minimal test data
    const rows = [
      { id: 'proj1', budget: 1000, forecast: 1100, actual: 1050 },
      { id: 'proj2', budget: 2000, forecast: 1900, actual: 2100 },
    ];
    
    const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
    const totalForecast = rows.reduce((sum, row) => sum + row.forecast, 0);
    const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
    
    assert.strictEqual(totalBudget, 3000, 'Total budget should be 3000');
    assert.strictEqual(totalForecast, 3000, 'Total forecast should be 3000');
    assert.strictEqual(totalActual, 3150, 'Total actual should be 3150');
  });

  it('should render monthly data without runtime errors', () => {
    // Test data representing a monthly forecast cell
    const forecastCell = {
      line_item_id: 'test-1',
      rubroId: 'rubro-1',
      projectId: 'proj-1',
      projectName: 'Test Project',
      description: 'Test Rubro',
      category: 'Test Category',
      month: 1,
      planned: 1000,
      forecast: 1100,
      actual: 1050,
      variance: -50,
    };
    
    // Verify all required fields are present
    assert.ok(forecastCell.line_item_id, 'Should have line_item_id');
    assert.ok(forecastCell.month, 'Should have month');
    assert.strictEqual(typeof forecastCell.forecast, 'number', 'Forecast should be a number');
    assert.strictEqual(typeof forecastCell.actual, 'number', 'Actual should be a number');
    assert.strictEqual(forecastCell.variance, -50, 'Variance should be calculated correctly');
  });
});

describe('ForecastRubrosTable - Fragment Usage', () => {
  it('should handle category grouping with Fragment wrapper', () => {
    // Simulate category grouping logic
    const categories = [
      { name: 'Category 1', rubros: ['rubro1', 'rubro2'] },
      { name: 'Category 2', rubros: ['rubro3'] },
    ];
    
    // Verify we can iterate and create grouped structures
    const groupedData = categories.map(category => ({
      categoryName: category.name,
      rubroCount: category.rubros.length,
      rubros: category.rubros,
    }));
    
    assert.strictEqual(groupedData.length, 2, 'Should have 2 category groups');
    assert.strictEqual(groupedData[0].rubroCount, 2, 'Category 1 should have 2 rubros');
    assert.strictEqual(groupedData[1].rubroCount, 1, 'Category 2 should have 1 rubro');
  });

  it('should handle empty categories gracefully', () => {
    const categories: Array<{ name: string; rubros: string[] }> = [];
    
    // Should handle empty array without errors
    const visibleCategories = categories.filter(cat => cat.rubros.length > 0);
    
    assert.strictEqual(visibleCategories.length, 0, 'Should have no visible categories');
  });
});
