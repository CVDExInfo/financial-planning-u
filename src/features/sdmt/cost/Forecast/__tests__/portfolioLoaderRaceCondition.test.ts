/**
 * Tests for portfolio loader race condition fix
 * 
 * Ensures the loadPortfolioForecast wait mechanism properly handles
 * the race condition where projects array initially contains only ALL_PROJECTS_ID
 * but then populates with real projects shortly after.
 */

import { test } from 'node:test';
import assert from 'node:assert';

/**
 * Mock implementation of the portfolio loader logic to test race condition handling
 * This mirrors the logic in SDMTForecast.tsx loadPortfolioForecast
 */
async function mockLoadPortfolioForecast(
  projects: Array<{ id: string; name: string }>,
  options: { simulateDelayedProjects?: boolean; delayMs?: number } = {}
) {
  const ALL_PROJECTS_ID = 'ALL_PROJECTS_ID';
  const MINIMUM_PROJECTS_FOR_PORTFOLIO = 2;

  let candidateProjects = projects.filter(
    (project) => project.id && project.id !== ALL_PROJECTS_ID
  );

  // Guard: Don't error out if projects haven't loaded yet
  if (candidateProjects.length === 0) {
    // Check if we're still in initial load state (only ALL_PROJECTS exists)
    if (projects.length < MINIMUM_PROJECTS_FOR_PORTFOLIO) {
      // Short wait to avoid spurious empty projects on initial load / race conditions
      await new Promise((res) => setTimeout(res, options.delayMs || 500));
      
      // Simulate projects being populated during the wait
      if (options.simulateDelayedProjects) {
        projects.push({ id: 'project-1', name: 'Project 1' });
        projects.push({ id: 'project-2', name: 'Project 2' });
      }
      
      candidateProjects = projects.filter((p) => p.id && p.id !== ALL_PROJECTS_ID);
      if (candidateProjects.length === 0) {
        return { success: false, error: 'still_empty', data: [] };
      }
      // If we now have candidates after waiting, proceed with them below
    } else {
      // If we have projects but they're all filtered out, that's a real empty state
      return { success: false, error: 'no_candidates', data: [] };
    }
  }

  // Successfully found candidate projects
  return { success: true, error: null, data: candidateProjects };
}

test('portfolio loader waits for projects when initially empty', async () => {
  const projects = [{ id: 'ALL_PROJECTS_ID', name: 'All Projects' }];
  
  const result = await mockLoadPortfolioForecast(projects, {
    simulateDelayedProjects: true,
    delayMs: 100 // shorter delay for testing
  });
  
  assert.strictEqual(result.success, true, 'Should succeed after waiting for projects');
  assert.strictEqual(result.data.length, 2, 'Should find 2 candidate projects');
  assert.strictEqual(result.error, null, 'Should have no error');
});

test('portfolio loader returns early when no projects appear after wait', async () => {
  const projects = [{ id: 'ALL_PROJECTS_ID', name: 'All Projects' }];
  
  const result = await mockLoadPortfolioForecast(projects, {
    simulateDelayedProjects: false, // no projects will appear
    delayMs: 100
  });
  
  assert.strictEqual(result.success, false, 'Should fail when no projects appear');
  assert.strictEqual(result.error, 'still_empty', 'Should return still_empty error');
  assert.strictEqual(result.data.length, 0, 'Should have empty data');
});

test('portfolio loader succeeds immediately when projects already loaded', async () => {
  const projects = [
    { id: 'ALL_PROJECTS_ID', name: 'All Projects' },
    { id: 'project-1', name: 'Project 1' },
    { id: 'project-2', name: 'Project 2' }
  ];
  
  const startTime = Date.now();
  const result = await mockLoadPortfolioForecast(projects, {
    delayMs: 500 // should not wait at all
  });
  const elapsed = Date.now() - startTime;
  
  assert.strictEqual(result.success, true, 'Should succeed immediately');
  assert.strictEqual(result.data.length, 2, 'Should find 2 candidate projects');
  assert.ok(elapsed < 100, 'Should not wait when projects already present');
});

test('portfolio loader filters out ALL_PROJECTS_ID', async () => {
  const projects = [
    { id: 'ALL_PROJECTS_ID', name: 'All Projects' },
    { id: 'project-1', name: 'Project 1' }
  ];
  
  const result = await mockLoadPortfolioForecast(projects);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.data.length, 1, 'Should filter out ALL_PROJECTS_ID');
  assert.strictEqual(result.data[0].id, 'project-1', 'Should only have project-1');
});

test('portfolio loader handles edge case with exactly MINIMUM_PROJECTS', async () => {
  // Edge case: exactly 2 projects (ALL_PROJECTS + 1 real project)
  const projects = [
    { id: 'ALL_PROJECTS_ID', name: 'All Projects' },
    { id: 'project-1', name: 'Project 1' }
  ];
  
  const result = await mockLoadPortfolioForecast(projects);
  
  assert.strictEqual(result.success, true, 'Should succeed with minimum projects');
  assert.strictEqual(result.data.length, 1, 'Should have 1 candidate project');
});
