/**
 * ForecastRubrosTable Controlled View Tests
 * 
 * Tests for external viewMode control (controlled/uncontrolled pattern):
 * - Controlled mode: renders specified view and does not write to sessionStorage
 * - Uncontrolled mode: persists internal view toggles to sessionStorage
 * - Hybrid mode: effectiveViewMode = externalViewMode ?? internalViewMode
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForecastRubrosTable } from '../ForecastRubrosTable';
import type { PortfolioTotals } from '../categoryGrouping';

// Mock dependencies
jest.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({
    selectedProject: { id: 'test-project', name: 'Test Project' },
  }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com', login: 'testuser' },
  }),
}));

describe('ForecastRubrosTable - Controlled View', () => {
  const mockCategoryTotals = new Map();
  const mockCategoryRubros = new Map();
  const mockPortfolioTotals: PortfolioTotals = {
    byMonth: {},
    overall: {
      forecast: 0,
      actual: 0,
      planned: 0,
      varianceActual: 0,
      varianceForecast: 0,
      percentConsumption: 0,
    },
  };
  const mockMonthlyBudgets = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    budget: 1000,
  }));
  const mockOnSaveBudget = jest.fn();
  const mockFormatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Controlled Mode (externalViewMode provided)', () => {
    it('should render project view when externalViewMode="project"', () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          externalViewMode="project"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // Verify project button is active
      const projectButton = screen.getByRole('button', { name: /Por Proyecto/i });
      expect(projectButton).toHaveClass('bg-primary');
    });

    it('should render category view when externalViewMode="category"', () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          externalViewMode="category"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // Verify category button is active
      const categoryButton = screen.getByRole('button', { name: /Por Categoría/i });
      expect(categoryButton).toHaveClass('bg-primary');
    });

    it('should NOT write to sessionStorage when controlled', () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          externalViewMode="project"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // SessionStorage should be empty (no viewMode persisted)
      const sessionKeys = Object.keys(sessionStorage);
      const viewModeKeys = sessionKeys.filter(key => key.includes('forecastGridViewMode'));
      expect(viewModeKeys.length).toBe(0);
    });

    it('should call onViewModeChange when toggling view in controlled mode', async () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          externalViewMode="category"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // Click project button
      const projectButton = screen.getByRole('button', { name: /Por Proyecto/i });
      fireEvent.click(projectButton);

      // Verify onViewModeChange was called with 'project'
      await waitFor(() => {
        expect(mockOnViewModeChange).toHaveBeenCalledWith('project');
      });
    });
  });

  describe('Uncontrolled Mode (no externalViewMode)', () => {
    it('should persist viewMode to sessionStorage when uncontrolled', async () => {
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          // No externalViewMode - uncontrolled
        />
      );

      // Initial render should write 'category' (default) to sessionStorage
      await waitFor(() => {
        const sessionKeys = Object.keys(sessionStorage);
        const viewModeKey = sessionKeys.find(key => key.includes('forecastGridViewMode'));
        expect(viewModeKey).toBeDefined();
        expect(sessionStorage.getItem(viewModeKey!)).toBe('category');
      });
    });

    it('should update sessionStorage when toggling view in uncontrolled mode', async () => {
      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          // No externalViewMode - uncontrolled
        />
      );

      // Click project button
      const projectButton = screen.getByRole('button', { name: /Por Proyecto/i });
      fireEvent.click(projectButton);

      // Verify sessionStorage updated to 'project'
      await waitFor(() => {
        const sessionKeys = Object.keys(sessionStorage);
        const viewModeKey = sessionKeys.find(key => key.includes('forecastGridViewMode'));
        expect(sessionStorage.getItem(viewModeKey!)).toBe('project');
      });
    });

    it('should restore viewMode from sessionStorage on mount when uncontrolled', () => {
      // Pre-populate sessionStorage with 'project'
      const sessionKey = 'forecastGridViewMode:test-project:test@example.com';
      sessionStorage.setItem(sessionKey, 'project');

      render(
        <ForecastRubrosTable
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveBudget={mockOnSaveBudget}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
          // No externalViewMode - should restore from session
        />
      );

      // Verify project button is active (restored from sessionStorage)
      const projectButton = screen.getByRole('button', { name: /Por Proyecto/i });
      expect(projectButton).toHaveClass('bg-primary');
    });
  });
});
