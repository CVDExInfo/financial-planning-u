/**
 * Example Integration - SDMTForecastV2
 * 
 * This file demonstrates how to integrate the new SDMTForecastV2 component
 * into your application routing and navigation.
 */

import { Route } from 'react-router-dom';
import { SDMTForecastV2 } from '@/features/sdmt/cost/Forecast/SDMTForecastV2';

/**
 * EXAMPLE 1: Basic Route Configuration
 * Add this to your router configuration
 */
export const forecastV2Route = {
  path: '/sdmt/forecast/v2',
  element: <SDMTForecastV2 />,
  // Optional: Add route metadata
  meta: {
    title: 'SDMT Forecast V2',
    requiresAuth: true,
    module: 'SDMT',
  },
};

/**
 * EXAMPLE 2: React Router v6 Route
 */
export function ForecastV2Routes() {
  return (
    <Route path="sdmt">
      <Route path="forecast">
        <Route path="v2" element={<SDMTForecastV2 />} />
      </Route>
    </Route>
  );
}

/**
 * EXAMPLE 3: Navigation Link Component
 */
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ForecastV2NavigationLink() {
  return (
    <Link to="/sdmt/forecast/v2">
      <Button variant="ghost" className="w-full justify-start">
        <TrendingUp className="mr-2 h-4 w-4" />
        Pronóstico V2
      </Button>
    </Link>
  );
}

/**
 * EXAMPLE 4: Programmatic Navigation
 */
import { useNavigate } from 'react-router-dom';

export function NavigateToForecastV2Button() {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate('/sdmt/forecast/v2');
  };
  
  return (
    <Button onClick={handleClick}>
      Ir a Pronóstico V2
    </Button>
  );
}

/**
 * EXAMPLE 5: Feature Flag Controlled Routing
 * Use feature flags to control which version to show
 */
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { SDMTForecast } from '@/features/sdmt/cost/Forecast/SDMTForecast'; // Original

export function ForecastRoute() {
  const useForecastV2 = FEATURE_FLAGS.USE_FORECAST_V2 || false;
  
  return (
    <Route 
      path="forecast" 
      element={useForecastV2 ? <SDMTForecastV2 /> : <SDMTForecast />} 
    />
  );
}

/**
 * EXAMPLE 6: Protected Route with Auth Check
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

function ProtectedForecastV2Route() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <SDMTForecastV2 />;
}

export const protectedForecastV2Route = {
  path: '/sdmt/forecast/v2',
  element: <ProtectedForecastV2Route />,
};

/**
 * EXAMPLE 7: Lazy Loading for Code Splitting
 */
import { lazy, Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

const SDMTForecastV2Lazy = lazy(() => 
  import('@/features/sdmt/cost/Forecast/SDMTForecastV2').then(module => ({
    default: module.SDMTForecastV2,
  }))
);

export function LazyForecastV2Route() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SDMTForecastV2Lazy />
    </Suspense>
  );
}

/**
 * EXAMPLE 8: Add to Sidebar Navigation Menu
 */
export const sidebarMenuItems = [
  {
    label: 'SDMT',
    children: [
      {
        label: 'Baseline',
        path: '/sdmt/baseline',
        icon: 'Ruler',
      },
      {
        label: 'Pronóstico',
        path: '/sdmt/forecast',
        icon: 'TrendingUp',
      },
      {
        label: 'Pronóstico V2',
        path: '/sdmt/forecast/v2',
        icon: 'BarChart3',
        badge: 'Nuevo',
        badgeVariant: 'success',
      },
      {
        label: 'Cambios',
        path: '/sdmt/changes',
        icon: 'GitBranch',
      },
    ],
  },
];

/**
 * EXAMPLE 9: Environment-based Route Selection
 * Use different routes based on environment
 */
export function getDefaultForecastRoute() {
  const isDevelopment = import.meta.env.DEV;
  const enableV2InProd = import.meta.env.VITE_FINZ_FORECAST_V2_ENABLED === 'true';
  
  if (isDevelopment || enableV2InProd) {
    return '/sdmt/forecast/v2';
  }
  
  return '/sdmt/forecast';
}

/**
 * EXAMPLE 10: Breadcrumb Configuration
 */
export const forecastV2Breadcrumbs = [
  { label: 'Inicio', path: '/' },
  { label: 'SDMT', path: '/sdmt' },
  { label: 'Pronóstico V2', path: '/sdmt/forecast/v2' },
];

/**
 * USAGE NOTES:
 * 
 * 1. The component handles its own state management and data loading
 * 2. No props are required - it uses context providers (useProject, useAuth)
 * 3. Ensure ProjectContext and AuthContext are available in parent tree
 * 4. The component will show loading state while fetching data
 * 5. Error states are handled internally with user-friendly messages
 * 6. All UI states (collapsed panels, year selection) persist to sessionStorage
 * 
 * REQUIRED CONTEXT PROVIDERS:
 * - ProjectProvider (from @/contexts/ProjectContext)
 * - AuthProvider (from @/hooks/useAuth)
 * 
 * OPTIONAL FEATURE FLAGS:
 * - VITE_FINZ_FORECAST_V2_ENABLED - Enable/disable V2 in production
 * - VITE_FINZ_NEW_DESIGN_SYSTEM - Use new design system
 * 
 * MIGRATION PATH:
 * 1. Deploy V2 alongside V1 at different route (/sdmt/forecast/v2)
 * 2. Test thoroughly with real users
 * 3. Use feature flag to switch default route
 * 4. Once stable, replace V1 route with V2
 * 5. Eventually deprecate and remove V1
 */
