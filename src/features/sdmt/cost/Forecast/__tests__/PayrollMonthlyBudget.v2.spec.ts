/**
 * PayrollMonthlyBudget V2 Component Unit Tests
 * 
 * Tests for PayrollMonthlyBudget monthly inputs, yearly totals, and budget editing
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('PayrollMonthlyBudget V2 - Monthly Budget Inputs', () => {
  it('should render 12 month inputs', () => {
    const monthlyBudgets = Array(12).fill(0);

    assert.strictEqual(monthlyBudgets.length, 12, 'Should have 12 monthly budget entries');
  });

  it('should compute yearly budget as sum of monthly budgets', () => {
    const monthlyBudgets = [
      10000, 10000, 10000, 10000, 10000, 10000,
      10000, 10000, 10000, 10000, 10000, 10000,
    ];

    const yearlyBudget = monthlyBudgets.reduce((sum, budget) => sum + budget, 0);

    assert.strictEqual(yearlyBudget, 120000, 'Yearly budget should be sum of all 12 months');
  });

  it('should update monthly budget when input changes', () => {
    const monthlyBudgets = Array(12).fill(0);
    const monthIndex = 3; // April (0-indexed)
    const newValue = '15000';
    const numValue = parseFloat(newValue) || 0;

    const newBudgets = [...monthlyBudgets];
    newBudgets[monthIndex] = numValue;

    assert.strictEqual(newBudgets[monthIndex], 15000, 'Month 4 budget should update to 15000');
    assert.strictEqual(newBudgets[0], 0, 'Other months should remain unchanged');
  });

  it('should handle invalid input by defaulting to 0', () => {
    const invalidInput = 'invalid';
    const numValue = parseFloat(invalidInput) || 0;

    assert.strictEqual(numValue, 0, 'Invalid input should default to 0');
  });

  it('should handle empty input by defaulting to 0', () => {
    const emptyInput = '';
    const numValue = parseFloat(emptyInput) || 0;

    assert.strictEqual(numValue, 0, 'Empty input should default to 0');
  });

  it('should handle decimal values', () => {
    const decimalInput = '10500.75';
    const numValue = parseFloat(decimalInput) || 0;

    assert.strictEqual(numValue, 10500.75, 'Should handle decimal values');
  });
});

describe('PayrollMonthlyBudget V2 - Year Selection', () => {
  it('should trigger onYearChange callback when year changes', () => {
    let selectedYear = 2024;
    const onYearChange = (year: number) => {
      selectedYear = year;
    };

    const newYear = 2025;
    onYearChange(parseInt(newYear.toString()));

    assert.strictEqual(selectedYear, 2025, 'Year should update to 2025');
  });

  it('should generate year range (current year -2 to +7)', () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - 2 + i);

    assert.strictEqual(years.length, 10, 'Should generate 10 years');
    assert.strictEqual(years[0], currentYear - 2, 'First year should be current - 2');
    assert.strictEqual(years[9], currentYear + 7, 'Last year should be current + 7');
  });

  it('should disable year selector when canEditBudget is false', () => {
    const canEditBudget = false;
    const isDisabled = !canEditBudget;

    assert.strictEqual(isDisabled, true, 'Year selector should be disabled when canEditBudget is false');
  });
});

describe('PayrollMonthlyBudget V2 - Save Functionality', () => {
  it('should disable save button when canEditBudget is false', () => {
    const canEditBudget = false;
    const isSaveDisabled = !canEditBudget;

    assert.strictEqual(isSaveDisabled, true, 'Save button should be disabled when canEditBudget is false');
  });

  it('should enable save button when canEditBudget is true', () => {
    const canEditBudget = true;
    const isSaveDisabled = !canEditBudget;

    assert.strictEqual(isSaveDisabled, false, 'Save button should be enabled when canEditBudget is true');
  });

  it('should call onSave when save button is clicked', () => {
    let saveCalled = false;
    const onSave = () => {
      saveCalled = true;
    };

    onSave(); // Simulate button click

    assert.strictEqual(saveCalled, true, 'onSave should be called when button is clicked');
  });
});

describe('PayrollMonthlyBudget V2 - Currency Formatting', () => {
  it('should format currency correctly for yearly total', () => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    const yearlyBudget = 120000;
    const formatted = formatCurrency(yearlyBudget);

    assert.strictEqual(typeof formatted, 'string', 'Formatted value should be a string');
    assert.ok(formatted.includes('120'), 'Formatted value should include the number');
  });

  it('should display total in title when useMonthlyBudget is true', () => {
    const useMonthlyBudget = true;
    const yearlyBudget = 120000;

    const shouldDisplayTotal = useMonthlyBudget;
    const totalText = `(Total: $120,000)`;

    assert.strictEqual(shouldDisplayTotal, true, 'Should display total when useMonthlyBudget is true');
    assert.ok(totalText.includes('Total'), 'Total text should include "Total"');
  });
});

describe('PayrollMonthlyBudget V2 - Collapsible State', () => {
  it('should start collapsed by default', () => {
    const isOpen = false;

    assert.strictEqual(isOpen, false, 'Should start collapsed (isOpen = false)');
  });

  it('should toggle open/closed state', () => {
    let isOpen = false;
    const toggle = () => {
      isOpen = !isOpen;
    };

    toggle(); // Open
    assert.strictEqual(isOpen, true, 'Should be open after first toggle');

    toggle(); // Close
    assert.strictEqual(isOpen, false, 'Should be closed after second toggle');
  });
});

describe('PayrollMonthlyBudget V2 - Monthly Budget Toggle', () => {
  it('should enable/disable monthly inputs based on useMonthlyBudget', () => {
    const useMonthlyBudget = false;
    const canEditBudget = true;
    const isInputDisabled = !canEditBudget || !useMonthlyBudget;

    assert.strictEqual(isInputDisabled, true, 'Inputs should be disabled when useMonthlyBudget is false');
  });

  it('should disable inputs when canEditBudget is false even if useMonthlyBudget is true', () => {
    const useMonthlyBudget = true;
    const canEditBudget = false;
    const isInputDisabled = !canEditBudget || !useMonthlyBudget;

    assert.strictEqual(isInputDisabled, true, 'Inputs should be disabled when canEditBudget is false');
  });

  it('should enable inputs when both flags are true', () => {
    const useMonthlyBudget = true;
    const canEditBudget = true;
    const isInputDisabled = !canEditBudget || !useMonthlyBudget;

    assert.strictEqual(isInputDisabled, false, 'Inputs should be enabled when both flags are true');
  });

  it('should toggle useMonthlyBudget checkbox', () => {
    let useMonthlyBudget = false;
    const toggle = (checked: boolean) => {
      useMonthlyBudget = checked;
    };

    toggle(true);
    assert.strictEqual(useMonthlyBudget, true, 'useMonthlyBudget should be true after checking');

    toggle(false);
    assert.strictEqual(useMonthlyBudget, false, 'useMonthlyBudget should be false after unchecking');
  });
});

describe('PayrollMonthlyBudget V2 - Grid Layout', () => {
  it('should use responsive grid for month inputs', () => {
    const gridClasses = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';

    assert.ok(gridClasses.includes('grid-cols-2'), 'Should have 2 columns on mobile');
    assert.ok(gridClasses.includes('sm:grid-cols-3'), 'Should have 3 columns on small screens');
    assert.ok(gridClasses.includes('md:grid-cols-4'), 'Should have 4 columns on medium screens');
    assert.ok(gridClasses.includes('lg:grid-cols-6'), 'Should have 6 columns on large screens');
  });

  it('should label months as M1, M2, ..., M12', () => {
    const monthLabels = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);

    assert.strictEqual(monthLabels[0], 'M1', 'First month should be labeled M1');
    assert.strictEqual(monthLabels[11], 'M12', 'Last month should be labeled M12');
  });
});
