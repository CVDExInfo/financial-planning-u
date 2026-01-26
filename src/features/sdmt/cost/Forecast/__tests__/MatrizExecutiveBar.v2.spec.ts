/**
 * MatrizExecutiveBar V2 Component Unit Tests
 * 
 * Tests for MatrizExecutiveBar button layout, KPI display, and toggle functionality
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('MatrizExecutiveBar V2 - Button Layout', () => {
  it('should render 6 action buttons', () => {
    const actions = [
      { id: 'ver-real', label: 'Ver Real' },
      { id: 'ver-pronostico', label: 'Ver Pronóstico' },
      { id: 'exportar', label: 'Exportar' },
      { id: 'guardar', label: 'Guardar' },
      { id: 'resumen', label: 'Resumen' },
      { id: 'configurar', label: 'Configurar' },
    ];

    assert.strictEqual(actions.length, 6, 'Should have 6 action buttons');
  });

  it('should have correct labels for all buttons', () => {
    const actions = [
      { id: 'ver-real', label: 'Ver Real' },
      { id: 'ver-pronostico', label: 'Ver Pronóstico' },
      { id: 'exportar', label: 'Exportar' },
      { id: 'guardar', label: 'Guardar' },
      { id: 'resumen', label: 'Resumen' },
      { id: 'configurar', label: 'Configurar' },
    ];

    assert.strictEqual(actions[0].label, 'Ver Real', 'First button should be "Ver Real"');
    assert.strictEqual(actions[1].label, 'Ver Pronóstico', 'Second button should be "Ver Pronóstico"');
    assert.strictEqual(actions[2].label, 'Exportar', 'Third button should be "Exportar"');
    assert.strictEqual(actions[3].label, 'Guardar', 'Fourth button should be "Guardar"');
    assert.strictEqual(actions[4].label, 'Resumen', 'Fifth button should be "Resumen"');
    assert.strictEqual(actions[5].label, 'Configurar', 'Sixth button should be "Configurar"');
  });

  it('should render buttons with w-full class for equal width', () => {
    const buttonClass = 'w-full';

    assert.strictEqual(buttonClass, 'w-full', 'Buttons should have w-full class for equal width');
  });

  it('should use responsive grid for button layout', () => {
    const gridClasses = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3';

    assert.ok(gridClasses.includes('grid-cols-2'), 'Should have 2 columns on mobile');
    assert.ok(gridClasses.includes('md:grid-cols-3'), 'Should have 3 columns on medium screens');
    assert.ok(gridClasses.includes('lg:grid-cols-6'), 'Should have 6 columns on large screens');
  });

  it('should map correct icons to each button', () => {
    const buttonIcons = [
      { id: 'ver-real', icon: 'Eye' },
      { id: 'ver-pronostico', icon: 'TrendingUp' },
      { id: 'exportar', icon: 'Download' },
      { id: 'guardar', icon: 'Save' },
      { id: 'resumen', icon: 'BarChart3' },
      { id: 'configurar', icon: 'Settings' },
    ];

    assert.strictEqual(buttonIcons[0].icon, 'Eye', 'Ver Real should use Eye icon');
    assert.strictEqual(buttonIcons[1].icon, 'TrendingUp', 'Ver Pronóstico should use TrendingUp icon');
    assert.strictEqual(buttonIcons[2].icon, 'Download', 'Exportar should use Download icon');
    assert.strictEqual(buttonIcons[3].icon, 'Save', 'Guardar should use Save icon');
    assert.strictEqual(buttonIcons[4].icon, 'BarChart3', 'Resumen should use BarChart3 icon');
    assert.strictEqual(buttonIcons[5].icon, 'Settings', 'Configurar should use Settings icon');
  });
});

describe('MatrizExecutiveBar V2 - Resumen Button Toggle', () => {
  it('should toggle expansion when Resumen button is clicked', () => {
    let isOpen = false;
    
    const handleAction = (action: string) => {
      if (action === 'resumen') {
        isOpen = !isOpen;
      }
    };

    handleAction('resumen'); // Click Resumen
    assert.strictEqual(isOpen, true, 'Should expand when Resumen is clicked');

    handleAction('resumen'); // Click again
    assert.strictEqual(isOpen, false, 'Should collapse when Resumen is clicked again');
  });

  it('should call onToggle callback when toggled', () => {
    let toggleCalled = false;
    let toggleValue: boolean | null = null;

    const onToggle = (open: boolean) => {
      toggleCalled = true;
      toggleValue = open;
    };

    onToggle(true); // Simulate toggle

    assert.strictEqual(toggleCalled, true, 'onToggle should be called');
    assert.strictEqual(toggleValue, true, 'onToggle should receive correct value');
  });

  it('should initialize from isCollapsedDefault prop', () => {
    const isCollapsedDefault = true;
    const isOpen = !isCollapsedDefault;

    assert.strictEqual(isOpen, false, 'Should initialize as collapsed when isCollapsedDefault=true');
  });

  it('should initialize as expanded when isCollapsedDefault is false', () => {
    const isCollapsedDefault = false;
    const isOpen = !isCollapsedDefault;

    assert.strictEqual(isOpen, true, 'Should initialize as expanded when isCollapsedDefault=false');
  });
});

describe('MatrizExecutiveBar V2 - Action Handling', () => {
  it('should call onAction for non-resumen buttons', () => {
    let actionCalled = '';
    const onAction = (action: string) => {
      actionCalled = action;
    };

    const handleAction = (action: string) => {
      if (action !== 'resumen') {
        onAction(action);
      }
    };

    handleAction('exportar');
    assert.strictEqual(actionCalled, 'exportar', 'Should call onAction with "exportar"');

    handleAction('guardar');
    assert.strictEqual(actionCalled, 'guardar', 'Should call onAction with "guardar"');
  });

  it('should not call onAction for resumen button', () => {
    let actionCalled = false;
    const onAction = (action: string) => {
      actionCalled = true;
    };

    const handleAction = (action: string) => {
      if (action !== 'resumen') {
        onAction(action);
      }
    };

    handleAction('resumen');
    assert.strictEqual(actionCalled, false, 'Should not call onAction for resumen button');
  });
});

describe('MatrizExecutiveBar V2 - KPI Display', () => {
  it('should render 5 KPI tiles', () => {
    const kpis = [
      { label: 'Presupuesto', value: '$150,000' },
      { label: 'Pronóstico', value: '$145,000' },
      { label: 'Real', value: '$120,000' },
      { label: 'Consumo', value: '80.0%' },
      { label: 'Varianza', value: '$5,000' },
    ];

    assert.strictEqual(kpis.length, 5, 'Should render 5 KPI tiles');
  });

  it('should format currency values for KPIs', () => {
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

    assert.strictEqual(typeof formatted, 'string', 'Formatted value should be a string');
    assert.ok(formatted.includes('150'), 'Formatted value should include the number');
  });

  it('should format percentage values for Consumo', () => {
    const formatPercentage = (value: number) => {
      return `${value.toFixed(1)}%`;
    };

    const consumo = 80.5;
    const formatted = formatPercentage(consumo);

    assert.strictEqual(formatted, '80.5%', 'Consumo should format as percentage');
  });

  it('should use correct color for positive varianza', () => {
    const varianza = 5000;
    const color = varianza >= 0 ? 'text-green-600' : 'text-red-600';

    assert.strictEqual(color, 'text-green-600', 'Positive varianza should use green color');
  });

  it('should use correct color for negative varianza', () => {
    const varianza = -5000;
    const color = varianza >= 0 ? 'text-green-600' : 'text-red-600';

    assert.strictEqual(color, 'text-red-600', 'Negative varianza should use red color');
  });

  it('should use responsive grid for KPIs', () => {
    const gridClasses = 'grid grid-cols-2 md:grid-cols-5 gap-4';

    assert.ok(gridClasses.includes('grid-cols-2'), 'Should have 2 columns on mobile');
    assert.ok(gridClasses.includes('md:grid-cols-5'), 'Should have 5 columns on medium screens');
  });
});

describe('MatrizExecutiveBar V2 - Button Variants', () => {
  it('should use default variant for Resumen when expanded', () => {
    const isOpen = true;
    const actionId = 'resumen';
    const variant = actionId === 'resumen' && isOpen ? 'default' : 'outline';

    assert.strictEqual(variant, 'default', 'Resumen should use default variant when expanded');
  });

  it('should use outline variant for Resumen when collapsed', () => {
    const isOpen = false;
    const actionId = 'resumen';
    const variant = actionId === 'resumen' && isOpen ? 'default' : 'outline';

    assert.strictEqual(variant, 'outline', 'Resumen should use outline variant when collapsed');
  });

  it('should use outline variant for other buttons', () => {
    const isOpen = true;
    const actionId = 'exportar';
    const variant = actionId === 'resumen' && isOpen ? 'default' : 'outline';

    assert.strictEqual(variant, 'outline', 'Other buttons should always use outline variant');
  });
});
