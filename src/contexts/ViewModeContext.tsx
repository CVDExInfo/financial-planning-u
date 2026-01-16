/**
 * ViewModeContext - Persona-based view state management
 * 
 * Provides a context for managing the view mode (SDM vs Gerente) across the application.
 * State is persisted to sessionStorage for continuity within a session.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ViewMode = 'sdm' | 'gerente';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const STORAGE_KEY = 'finanzas:viewMode';

interface ViewModeProviderProps {
  children: ReactNode;
}

export function ViewModeProvider({ children }: ViewModeProviderProps) {
  // Initialize from sessionStorage or default to 'sdm'
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === 'sdm' || stored === 'gerente') {
        return stored;
      }
    } catch (e) {
      // sessionStorage may not be available
      console.warn('Failed to read viewMode from sessionStorage:', e);
    }
    return 'sdm'; // default to SDM view
  });

  // Persist to sessionStorage whenever viewMode changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, viewMode);
    } catch (e) {
      console.warn('Failed to persist viewMode to sessionStorage:', e);
    }
  }, [viewMode]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextType {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
