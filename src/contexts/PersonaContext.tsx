/**
 * PersonaContext - View Mode Context for SDM vs Gerente Personas
 * 
 * Provides a centralized way to manage persona-based view preferences.
 * - SDM (Service Delivery Manager): Detailed, data-entry focused view
 * - Gerente (Manager/Executive): High-level, summary-focused view
 * 
 * This is independent of user roles/permissions and purely affects UI presentation.
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type PersonaViewMode = 'SDM' | 'Gerente';

interface PersonaContextValue {
  viewMode: PersonaViewMode;
  setViewMode: (mode: PersonaViewMode) => void;
}

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);

interface PersonaProviderProps {
  children: ReactNode;
  /** Optional: Default persona mode. If not provided, will load from localStorage or default to 'SDM' */
  defaultMode?: PersonaViewMode;
}

const STORAGE_KEY = 'finanzas:personaViewMode';

export function PersonaProvider({ children, defaultMode }: PersonaProviderProps) {
  // Initialize from localStorage or use default
  const [viewMode, setViewModeState] = useState<PersonaViewMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'SDM' || stored === 'Gerente') {
        return stored;
      }
    } catch (e) {
      // localStorage not available or error
      console.warn('Failed to load persona view mode from localStorage:', e);
    }
    return defaultMode || 'SDM';
  });

  // Persist to localStorage when changed
  const setViewMode = useCallback((mode: PersonaViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save persona view mode to localStorage:', e);
    }
  }, []);

  return (
    <PersonaContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </PersonaContext.Provider>
  );
}

/**
 * Hook to access persona view mode context
 */
export function usePersona(): PersonaContextValue {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}

/**
 * Hook to safely access persona view mode with fallback (for optional usage)
 */
export function usePersonaOptional(): PersonaContextValue | null {
  return useContext(PersonaContext);
}
