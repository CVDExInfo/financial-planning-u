import type { paths } from '@/types/api';

// Get environment configuration
const baseURL = import.meta.env.VITE_API_BASE_URL;
const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';

// Mock data imports
import projectsData from './mocks/projects.json';
import rubrosData from './mocks/rubros.json';
import planData from './mocks/plan.json';
import adjustmentsData from './mocks/adjustments.json';
import movementsData from './mocks/movements.json';
import providersData from './mocks/providers.json';

/**
 * Error structure for API responses
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;
  public readonly status?: number;

  constructor(error: ApiError, status?: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
    this.timestamp = error.timestamp;
    this.status = status;
  }
}

/**
 * Get JWT token from Cognito session
 * This assumes the same OAuth flow as acta-ui
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Check if we're in mock mode or skip auth mode
    if (useMocks || import.meta.env.VITE_SKIP_AUTH === 'true') {
      return 'mock-jwt-token';
    }

    // Try to get token from localStorage (where Cognito typically stores it)
    const cognitoKey = `CognitoIdentityServiceProvider.${import.meta.env.VITE_COGNITO_WEB_CLIENT_ID}`;
    const userKeys = Object.keys(localStorage).filter(key => 
      key.startsWith(cognitoKey) && key.endsWith('.idToken')
    );

    if (userKeys.length > 0) {
      return localStorage.getItem(userKeys[0]);
    }

    // If no token found, try session storage as fallback
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith(cognitoKey) && key.endsWith('.idToken')
    );

    if (sessionKeys.length > 0) {
      return sessionStorage.getItem(sessionKeys[0]);
    }

    return null;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
}

/**
 * Mock fetch function that returns mocked data
 */
function mockFetch(url: string, options?: RequestInit): Promise<Response> {
  console.log('[Mock API] Request:', options?.method || 'GET', url);

  // Parse the URL to determine which mock data to return
  const urlObj = new URL(url, baseURL || 'http://localhost:3000');
  const path = urlObj.pathname;

  let data: unknown = null;

  // Route to appropriate mock data
  if (path.includes('/projects') && !path.includes('/rubros') && !path.includes('/allocations') && !path.includes('/plan') && !path.includes('/handoff')) {
    data = projectsData;
  } else if (path.includes('/catalog/rubros')) {
    data = rubrosData;
  } else if (path.includes('/plan')) {
    data = planData;
  } else if (path.includes('/adjustments')) {
    data = adjustmentsData;
  } else if (path.includes('/movements')) {
    data = movementsData;
  } else if (path.includes('/providers')) {
    data = providersData;
  } else if (path.includes('/rubros')) {
    data = rubrosData;
  } else {
    // Default empty response
    data = { data: [], total: 0 };
  }

  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(JSON.stringify(data), {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    }, 300); // 300ms delay to simulate network
  });
}

/**
 * Typed fetch wrapper with JWT bearer token and error handling
 * 
 * @template T - The expected response type
 * @param path - API path (will be appended to baseURL)
 * @param options - Fetch options
 * @returns Promise with typed response
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // If using mocks, use mock fetch
  if (useMocks) {
    const response = await mockFetch(path, options);
    return response.json() as Promise<T>;
  }

  // Get auth token
  const token = await getAuthToken();

  // Build full URL
  const url = `${baseURL}${path}`;

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Make the request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 - Unauthorized (token expired or invalid)
    if (response.status === 401) {
      // TODO: Implement token refresh logic
      // For now, we'll just throw an error
      const errorData: ApiError = {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in again.',
        timestamp: new Date().toISOString(),
      };
      throw new ApiClientError(errorData, 401);
    }

    // Handle other error status codes
    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, create a generic error
        errorData = {
          code: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }
      throw new ApiClientError(errorData, response.status);
    }

    // Parse and return successful response
    const data = await response.json();
    return data as T;
  } catch (error) {
    // If it's already an ApiClientError, rethrow it
    if (error instanceof ApiClientError) {
      throw error;
    }

    // Handle network errors
    throw new ApiClientError(
      {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp: new Date().toISOString(),
      },
      0
    );
  }
}

/**
 * Type helper to extract response type from an operation
 */
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends keyof paths[Path][Method] extends 'responses'
    ? paths[Path][Method]['responses']
    : never = 200
> = paths[Path][Method] extends { responses: infer R }
  ? Status extends keyof R
    ? R[Status] extends { content: { 'application/json': infer C } }
      ? C
      : never
    : never
  : never;

/**
 * Type helper to extract request body type from an operation
 */
export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { requestBody: infer R }
  ? R extends { content: { 'application/json': infer C } }
    ? C
    : never
  : never;
