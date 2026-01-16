/**
 * PersonaTabs Component Tests
 * 
 * Tests for persona view mode toggle functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PersonaTabs } from '../PersonaTabs';
import { PersonaProvider } from '@/contexts/PersonaContext';

describe('PersonaTabs', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('renders SDM and Gerente tabs', () => {
    render(
      <PersonaProvider>
        <PersonaTabs />
      </PersonaProvider>
    );

    expect(screen.getByText('SDM')).toBeInTheDocument();
    expect(screen.getByText('Gerente')).toBeInTheDocument();
  });

  it('defaults to SDM view mode', () => {
    render(
      <PersonaProvider>
        <PersonaTabs />
      </PersonaProvider>
    );

    const sdmTab = screen.getByRole('tab', { name: /SDM/i });
    expect(sdmTab).toHaveAttribute('data-state', 'active');
  });

  it('switches to Gerente view mode when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <PersonaProvider>
        <PersonaTabs />
      </PersonaProvider>
    );

    const gerenteTab = screen.getByRole('tab', { name: /Gerente/i });
    await user.click(gerenteTab);

    expect(gerenteTab).toHaveAttribute('data-state', 'active');
  });

  it('persists view mode to localStorage', async () => {
    const user = userEvent.setup();
    
    render(
      <PersonaProvider>
        <PersonaTabs />
      </PersonaProvider>
    );

    const gerenteTab = screen.getByRole('tab', { name: /Gerente/i });
    await user.click(gerenteTab);

    expect(localStorage.getItem('finanzas:personaViewMode')).toBe('Gerente');
  });

  it('loads view mode from localStorage', () => {
    localStorage.setItem('finanzas:personaViewMode', 'Gerente');

    render(
      <PersonaProvider>
        <PersonaTabs />
      </PersonaProvider>
    );

    const gerenteTab = screen.getByRole('tab', { name: /Gerente/i });
    expect(gerenteTab).toHaveAttribute('data-state', 'active');
  });

  it('honors defaultMode prop when no localStorage value exists', () => {
    render(
      <PersonaProvider defaultMode="Gerente">
        <PersonaTabs />
      </PersonaProvider>
    );

    const gerenteTab = screen.getByRole('tab', { name: /Gerente/i });
    expect(gerenteTab).toHaveAttribute('data-state', 'active');
  });
});
