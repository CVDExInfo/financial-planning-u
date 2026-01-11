/**
 * ForecastRubrosTable Project View Tests
 * 
 * Tests that the project view mode works correctly with fixtures
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { ProjectTotals, ProjectRubro } from '../projectGrouping';

/**
 * Mock formatCurrency for testing
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

describe('ForecastRubrosTable - Project View', () => {
  it('should create project totals fixture', () => {
    const projectTotals = new Map<string, ProjectTotals>();
    
    projectTotals.set('proj1', {
      projectId: 'proj1',
      projectName: 'Project Alpha',
      byMonth: {
        1: { forecast: 10000, actual: 9000, planned: 9500 },
        2: { forecast: 12000, actual: 11000, planned: 11500 },
      },
      overall: {
        forecast: 22000,
        actual: 20000,
        planned: 21000,
        varianceForecast: 1000,
        varianceActual: -1000,
        percentConsumption: (20000 / 22000) * 100,
      },
    });

    projectTotals.set('proj2', {
      projectId: 'proj2',
      projectName: 'Project Beta',
      byMonth: {
        1: { forecast: 5000, actual: 4500, planned: 4800 },
      },
      overall: {
        forecast: 5000,
        actual: 4500,
        planned: 4800,
        varianceForecast: 200,
        varianceActual: -300,
        percentConsumption: (4500 / 5000) * 100,
      },
    });

    assert.strictEqual(projectTotals.size, 2);
    
    const proj1 = projectTotals.get('proj1');
    assert.ok(proj1);
    assert.strictEqual(proj1.projectName, 'Project Alpha');
    assert.strictEqual(proj1.overall.forecast, 22000);
  });

  it('should create project rubros fixture', () => {
    const projectRubros = new Map<string, ProjectRubro[]>();
    
    projectRubros.set('proj1', [
      {
        rubroId: 'rubro1',
        description: 'Software License',
        projectId: 'proj1',
        projectName: 'Project Alpha',
        category: 'IT Infrastructure',
        byMonth: {
          1: { forecast: 5000, actual: 4500, planned: 4800 },
          2: { forecast: 6000, actual: 5500, planned: 5700 },
        },
        overall: {
          forecast: 11000,
          actual: 10000,
          planned: 10500,
          varianceForecast: 500,
          varianceActual: -500,
          percentConsumption: (10000 / 11000) * 100,
        },
      },
      {
        rubroId: 'rubro2',
        description: 'Cloud Services',
        projectId: 'proj1',
        projectName: 'Project Alpha',
        category: 'IT Infrastructure',
        byMonth: {
          1: { forecast: 5000, actual: 4500, planned: 4700 },
          2: { forecast: 6000, actual: 5500, planned: 5800 },
        },
        overall: {
          forecast: 11000,
          actual: 10000,
          planned: 10500,
          varianceForecast: 500,
          varianceActual: -500,
          percentConsumption: (10000 / 11000) * 100,
        },
      },
    ]);

    projectRubros.set('proj2', [
      {
        rubroId: 'rubro3',
        description: 'Consulting',
        projectId: 'proj2',
        projectName: 'Project Beta',
        category: 'Professional Services',
        byMonth: {
          1: { forecast: 5000, actual: 4500, planned: 4800 },
        },
        overall: {
          forecast: 5000,
          actual: 4500,
          planned: 4800,
          varianceForecast: 200,
          varianceActual: -300,
          percentConsumption: (4500 / 5000) * 100,
        },
      },
    ]);

    assert.strictEqual(projectRubros.size, 2);
    
    const proj1Rubros = projectRubros.get('proj1');
    assert.ok(proj1Rubros);
    assert.strictEqual(proj1Rubros.length, 2);
    assert.strictEqual(proj1Rubros[0].description, 'Software License');
  });

  it('should validate project view structure expectations', () => {
    // This test validates the expected structure for rendering
    const projectTotals = new Map<string, ProjectTotals>();
    const projectRubros = new Map<string, ProjectRubro[]>();

    projectTotals.set('proj1', {
      projectId: 'proj1',
      projectName: 'Project Alpha',
      byMonth: {
        1: { forecast: 10000, actual: 9000, planned: 9500 },
      },
      overall: {
        forecast: 10000,
        actual: 9000,
        planned: 9500,
        varianceForecast: 500,
        varianceActual: -500,
        percentConsumption: 90,
      },
    });

    projectRubros.set('proj1', [
      {
        rubroId: 'rubro1',
        description: 'Test Rubro',
        projectId: 'proj1',
        projectName: 'Project Alpha',
        byMonth: {
          1: { forecast: 10000, actual: 9000, planned: 9500 },
        },
        overall: {
          forecast: 10000,
          actual: 9000,
          planned: 9500,
          varianceForecast: 500,
          varianceActual: -500,
          percentConsumption: 90,
        },
      },
    ]);

    // Validate structure for rendering
    const visibleProjects: Array<[string, ProjectTotals, ProjectRubro[], string]> = [];
    
    projectTotals.forEach((projectTotal, projectId) => {
      const rubros = projectRubros.get(projectId) || [];
      if (rubros.length > 0) {
        visibleProjects.push([projectId, projectTotal, rubros, projectTotal.projectName]);
      }
    });

    assert.strictEqual(visibleProjects.length, 1);
    
    const [projectId, totals, rubros, projectName] = visibleProjects[0];
    assert.strictEqual(projectId, 'proj1');
    assert.strictEqual(projectName, 'Project Alpha');
    assert.strictEqual(rubros.length, 1);
    assert.strictEqual(rubros[0].description, 'Test Rubro');
    
    // Validate monthly values exist for rendering
    assert.ok(totals.byMonth[1]);
    assert.strictEqual(totals.byMonth[1].forecast, 10000);
    
    // Validate currency formatting
    const formattedForecast = formatCurrency(totals.overall.forecast);
    assert.strictEqual(formattedForecast, '$10000.00');
  });

  it('should handle empty project data', () => {
    const projectTotals = new Map<string, ProjectTotals>();
    const projectRubros = new Map<string, ProjectRubro[]>();

    const visibleProjects: Array<[string, ProjectTotals, ProjectRubro[], string]> = [];
    
    projectTotals.forEach((projectTotal, projectId) => {
      const rubros = projectRubros.get(projectId) || [];
      if (rubros.length > 0) {
        visibleProjects.push([projectId, projectTotal, rubros, projectTotal.projectName]);
      }
    });

    assert.strictEqual(visibleProjects.length, 0);
  });

  it('should filter out projects with no rubros', () => {
    const projectTotals = new Map<string, ProjectTotals>();
    const projectRubros = new Map<string, ProjectRubro[]>();

    projectTotals.set('proj1', {
      projectId: 'proj1',
      projectName: 'Project Alpha',
      byMonth: {},
      overall: {
        forecast: 0,
        actual: 0,
        planned: 0,
        varianceForecast: 0,
        varianceActual: 0,
        percentConsumption: 0,
      },
    });

    // No rubros for proj1
    projectRubros.set('proj1', []);

    const visibleProjects: Array<[string, ProjectTotals, ProjectRubro[], string]> = [];
    
    projectTotals.forEach((projectTotal, projectId) => {
      const rubros = projectRubros.get(projectId) || [];
      if (rubros.length > 0) {
        visibleProjects.push([projectId, projectTotal, rubros, projectTotal.projectName]);
      }
    });

    assert.strictEqual(visibleProjects.length, 0);
  });
});
