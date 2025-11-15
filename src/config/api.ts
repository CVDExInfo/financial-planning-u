/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

// API Base URL - use environment variable in production
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  'https://m3g6am67aj.execute-api.us-east-2.amazonaws.com/dev';

// API Endpoints
export const API_ENDPOINTS = {
  // Projects
  projects: '/projects',
  projectById: (id: string) => `/projects/${id}`,
  
  // Rubros (Chart of Accounts)
  rubros: '/rubros',
  rubroById: (id: string) => `/rubros/${id}`,
  
  // Allocations
  allocations: '/allocations',
  allocationsByProject: (projectId: string) => `/allocations?project_id=${projectId}`,
  
  // Baseline
  baseline: '/baseline',
  baselineById: (id: string) => `/baseline/${id}`,
  
  // Billing
  billing: '/billing',
  billingByProject: (projectId: string) => `/billing?project_id=${projectId}`,
  
  // Handoff
  handoff: '/handoff',
  
  // Providers
  providers: '/providers',
  providerById: (id: string) => `/providers/${id}`,
} as const;

// Helper function to build full URL
export function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

// Helper function to get auth token from localStorage
export function getAuthToken(): string | null {
  try {
    const authData = localStorage.getItem('auth');
    if (!authData) return null;
    
    const parsed = JSON.parse(authData);
    return parsed.idToken || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

// Helper function to build request headers
export function buildHeaders(includeAuth: boolean = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

// Helper function to handle API errors
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = `API Error: ${response.status} ${response.statusText}`;
  
  try {
    const errorData = await response.json();
    if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    // Could not parse error response as JSON
  }
  
  throw new Error(errorMessage);
}
