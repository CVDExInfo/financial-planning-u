/**
 * ForecastRubrosAdapter Legacy Parity Tests
 * 
 * Tests that adapter provides same behavior as legacy table:
 * - Renders same data structure
 * - Invokes same callbacks (budget save, reconcile, export)
 * - Delegates rendering to ForecastRubrosTable
 * - Preserves controlled viewMode behavior
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForecastRubrosAdapter } from '../ForecastRubrosAdapter';
import type { PortfolioTotals } from '../../categoryGrouping';

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

describe('ForecastRubrosAdapter - Legacy Parity', () => {
  const mockCategoryTotals = new Map();
  const mockCategoryRubros = new Map();
  const mockPortfolioTotals: PortfolioTotals = {
    byMonth: {},
    overall: {
      forecast: 100000,
      actual: 95000,
      planned: 98000,
      varianceActual: -3000,
      varianceForecast: 2000,
      percentConsumption: 95,
    },
  };
  const mockMonthlyBudgets = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    budget: 10000 + i * 1000,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render ForecastRubrosTable component', () => {
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          canEditBudget={true}
        />
      );

      // Verify core table elements are rendered
      expect(screen.getByText(/Rubros por Categoría/i)).toBeInTheDocument();
      expect(screen.getByText(/Presupuesto All-In/i)).toBeInTheDocument();
    });

    it('should render with controlled viewMode', () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          externalViewMode="category"
          onViewModeChange={mockOnViewModeChange}
          canEditBudget={true}
        />
      );

      // Verify category view is active
      const categoryButton = screen.getByRole('button', { name: /Por Categoría/i });
      expect(categoryButton).toHaveClass('bg-primary');
    });

    it('should show materialization hint in DEV when pending', () => {
      // Mock DEV environment
      const originalEnv = import.meta.env.DEV;
      Object.defineProperty(import.meta.env, 'DEV', { value: true, writable: true });

      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          materializationPending={true}
          canEditBudget={true}
        />
      );

      // Verify materialization warning is shown
      expect(screen.getByText(/Baseline materialization pending/i)).toBeInTheDocument();

      // Restore original environment
      Object.defineProperty(import.meta.env, 'DEV', { value: originalEnv, writable: true });
    });
  });

  describe('Budget Save Callback', () => {
    it('should call onSaveMonthlyBudget when budget is saved', async () => {
      const mockOnSaveBudget = jest.fn().mockResolvedValue(undefined);
      
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          onSaveMonthlyBudget={mockOnSaveBudget}
          canEditBudget={true}
        />
      );

      // Click edit button
      const editButton = screen.getByLabelText(/Editar presupuesto/i);
      fireEvent.click(editButton);

      // Modify a budget value
      const budgetInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(budgetInputs[0], { target: { value: '15000' } });

      // Click save button
      const saveButton = screen.getByLabelText(/Guardar presupuesto/i);
      fireEvent.click(saveButton);

      // Verify onSaveMonthlyBudget was called with updated budgets
      await waitFor(() => {
        expect(mockOnSaveBudget).toHaveBeenCalled();
        const savedBudgets = mockOnSaveBudget.mock.calls[0][0];
        expect(savedBudgets[0].budget).toBe(15000);
      });
    });

    it('should use default handler if onSaveMonthlyBudget not provided', async () => {
      // Spy on console.warn
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          canEditBudget={true}
          // No onSaveMonthlyBudget provided
        />
      );

      // Click edit button
      const editButton = screen.getByLabelText(/Editar presupuesto/i);
      fireEvent.click(editButton);

      // Click save button
      const saveButton = screen.getByLabelText(/Guardar presupuesto/i);
      fireEvent.click(saveButton);

      // Verify default handler logs warning
      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('No onSaveMonthlyBudget handler provided')
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Currency Formatting', () => {
    it('should use custom formatCurrency if provided', () => {
      const mockFormatCurrency = (amount: number) => `€${amount.toFixed(2)}`;
      
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          formatCurrency={mockFormatCurrency}
          canEditBudget={true}
        />
      );

      // Verify EUR formatting is used (budget values should show € symbol)
      const budgetCells = screen.getAllByText(/€/);
      expect(budgetCells.length).toBeGreaterThan(0);
    });

    it('should use default USD formatting if formatCurrency not provided', () => {
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          canEditBudget={true}
          // No formatCurrency provided
        />
      );

      // Verify USD formatting is used (budget values should show $ symbol)
      const budgetCells = screen.getAllByText(/\$/);
      expect(budgetCells.length).toBeGreaterThan(0);
    });
  });

  describe('ViewMode Control', () => {
    it('should delegate viewMode changes to onViewModeChange', async () => {
      const mockOnViewModeChange = jest.fn();
      
      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          externalViewMode="category"
          onViewModeChange={mockOnViewModeChange}
          canEditBudget={true}
        />
      );

      // Toggle to project view
      const projectButton = screen.getByRole('button', { name: /Por Proyecto/i });
      fireEvent.click(projectButton);

      // Verify onViewModeChange was called
      await waitFor(() => {
        expect(mockOnViewModeChange).toHaveBeenCalledWith('project');
      });
    });
  });

  describe('Development Logging', () => {
    it('should log adapter details in DEV mode', () => {
      // Mock DEV environment and console.log
      const originalEnv = import.meta.env.DEV;
      Object.defineProperty(import.meta.env, 'DEV', { value: true, writable: true });
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      render(
        <ForecastRubrosAdapter
          categoryTotals={mockCategoryTotals}
          categoryRubros={mockCategoryRubros}
          portfolioTotals={mockPortfolioTotals}
          monthlyBudgets={mockMonthlyBudgets}
          externalViewMode="project"
          canEditBudget={true}
        />
      );

      // Verify DEV logs were called
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ForecastRubrosAdapter] Rendering with:'),
        expect.objectContaining({
          externalViewMode: 'project',
          controlledMode: true,
        })
      );

      consoleLogSpy.mockRestore();
      Object.defineProperty(import.meta.env, 'DEV', { value: originalEnv, writable: true });
    });
  });
});
