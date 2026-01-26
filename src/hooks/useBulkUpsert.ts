/**
 * useBulkUpsert Hook
 * 
 * React Query mutation hook for bulk forecast upserts in DashboardV2
 * Handles optimistic updates, conflict resolution, and idempotency
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import finanzasClient from '@/api/finanzasClient';
import type { PortfolioForecastData } from './useDashboardData';

/**
 * Bulk upsert item
 */
export interface BulkUpsertItem {
  projectId: string;
  canonicalRubroId: string;
  monthIndex: number;
  value: number;
  valueType: 'forecast' | 'actual';
  expected_last_updated?: string;
}

/**
 * Bulk upsert request
 */
export interface BulkUpsertRequest {
  items: BulkUpsertItem[];
  /** Optional idempotency key - auto-generated if not provided */
  idempotencyKey?: string;
}

/**
 * Bulk upsert response
 */
export interface BulkUpsertResponse {
  idempotencyKey: string;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    index: number;
    status: 'success' | 'conflict' | 'error';
    message?: string;
    current_last_updated?: string;
  }>;
  auditLogId?: string;
}

/**
 * Bulk upsert options
 */
export interface BulkUpsertOptions {
  /**
   * Enable optimistic updates
   * When true, UI updates immediately before server confirmation
   * Default: true
   */
  optimistic?: boolean;
  
  /**
   * Auto-retry conflicts with updated timestamp
   * When true, automatically retries conflict items with current timestamp
   * Default: false (manual conflict resolution)
   */
  autoRetryConflicts?: boolean;
  
  /**
   * Callback on conflicts detected
   */
  onConflict?: (conflicts: Array<{
    index: number;
    item: BulkUpsertItem;
    current_last_updated: string;
  }>) => void;
  
  /**
   * Callback on partial success (some items failed)
   */
  onPartialSuccess?: (response: BulkUpsertResponse) => void;
}

/**
 * Apply optimistic updates to cached data
 */
function applyOptimisticUpdates(
  cachedData: PortfolioForecastData | undefined,
  items: BulkUpsertItem[]
): PortfolioForecastData | undefined {
  if (!cachedData) return undefined;
  
  // Clone the data to avoid mutations
  const updated = JSON.parse(JSON.stringify(cachedData)) as PortfolioForecastData;
  
  // Apply each item update
  for (const item of items) {
    // Find the project
    const project = updated.projects.find(p => p.projectId === item.projectId);
    if (!project) continue;
    
    // Find the rubro within the project
    const rubro = project.rubros.find(r => r.canonicalId === item.canonicalRubroId);
    if (!rubro) continue;
    
    // Find the month data
    const monthData = rubro.monthlyData.find(m => m.monthIndex === item.monthIndex);
    if (!monthData) continue;
    
    // Update the value
    if (item.valueType === 'forecast') {
      monthData.forecast = item.value;
    } else {
      monthData.actual = item.value;
    }
    
    // Recalculate variance
    monthData.variance = monthData.actual - monthData.planned;
  }
  
  // Note: We don't recalculate totals here for performance
  // The server response will have correct totals
  
  return updated;
}

/**
 * useBulkUpsert Hook
 * 
 * Mutation hook for bulk forecast upserts with optimistic updates and conflict handling
 * 
 * @param options - Bulk upsert options
 * @returns React Query mutation result
 * 
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useBulkUpsert({
 *   optimistic: true,
 *   onConflict: (conflicts) => {
 *     console.error('Conflicts detected:', conflicts);
 *   },
 * });
 * 
 * // Usage:
 * mutate({
 *   items: [
 *     {
 *       projectId: 'proj-123',
 *       canonicalRubroId: 'MOD-ING',
 *       monthIndex: 0,
 *       value: 50000,
 *       valueType: 'forecast',
 *     },
 *   ],
 * });
 * ```
 */
export function useBulkUpsert(
  options: BulkUpsertOptions = {}
): UseMutationResult<BulkUpsertResponse, Error, BulkUpsertRequest> {
  const queryClient = useQueryClient();
  const {
    optimistic = true,
    autoRetryConflicts = false,
    onConflict,
    onPartialSuccess,
  } = options;

  return useMutation<BulkUpsertResponse, Error, BulkUpsertRequest>({
    mutationFn: async (request: BulkUpsertRequest) => {
      // Generate idempotency key if not provided
      const idempotencyKey = request.idempotencyKey || uuidv4();
      
      // Validate items
      if (!request.items || request.items.length === 0) {
        throw new Error('At least one item is required');
      }
      
      if (request.items.length > 1000) {
        throw new Error('Maximum 1000 items per request');
      }
      
      // Execute bulk upsert
      const response = await finanzasClient.bulkUpsertForecast({
        idempotencyKey,
        items: request.items,
      });
      
      // Check for conflicts
      const conflicts = response.results
        .filter(r => r.status === 'conflict')
        .map(r => ({
          index: r.index,
          item: request.items[r.index],
          current_last_updated: r.current_last_updated || '',
        }));
      
      if (conflicts.length > 0) {
        onConflict?.(conflicts);
        
        if (autoRetryConflicts) {
          // Auto-retry with updated timestamps
          const retryItems = conflicts.map(c => ({
            ...c.item,
            expected_last_updated: c.current_last_updated,
          }));
          
          // Recursive retry (only once to avoid infinite loops)
          if (request.idempotencyKey) {
            // Already retried once, don't retry again
            console.warn('[BulkUpsert] Conflicts persist after retry. Manual resolution required.');
          } else {
            console.info('[BulkUpsert] Retrying conflicts with updated timestamps...');
            return finanzasClient.bulkUpsertForecast({
              idempotencyKey: uuidv4(),
              items: retryItems,
            });
          }
        }
      }
      
      // Check for partial success
      if (response.failureCount > 0) {
        onPartialSuccess?.(response);
      }
      
      return response;
    },
    
    // Optimistic updates
    onMutate: async (request) => {
      if (!optimistic) return;
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dashboardData'] });
      
      // Snapshot previous data
      const previousData = queryClient.getQueriesData<PortfolioForecastData>({
        queryKey: ['dashboardData'],
      });
      
      // Optimistically update all matching queries
      queryClient.setQueriesData<PortfolioForecastData>(
        { queryKey: ['dashboardData'] },
        (old) => applyOptimisticUpdates(old, request.items)
      );
      
      return { previousData };
    },
    
    // Rollback on error
    onError: (err, request, context) => {
      if (optimistic && context?.previousData) {
        // Restore previous data
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      
      console.error('[BulkUpsert] Error:', err);
    },
    
    // Invalidate and refetch on success
    onSuccess: (response) => {
      // Invalidate dashboard data queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      
      if (response.failureCount === 0) {
        console.info(`[BulkUpsert] Successfully updated ${response.successCount} items`);
      } else {
        console.warn(
          `[BulkUpsert] Partial success: ${response.successCount} succeeded, ${response.failureCount} failed`
        );
      }
    },
  });
}

/**
 * Helper to generate idempotency key
 * Uses a combination of timestamp and random UUID to ensure uniqueness
 */
export function generateIdempotencyKey(): string {
  return uuidv4();
}

/**
 * Helper to check if a bulk upsert response has conflicts
 */
export function hasConflicts(response: BulkUpsertResponse): boolean {
  return response.results.some(r => r.status === 'conflict');
}

/**
 * Helper to check if a bulk upsert response has errors
 */
export function hasErrors(response: BulkUpsertResponse): boolean {
  return response.results.some(r => r.status === 'error');
}

/**
 * Helper to get failed items from a bulk upsert response
 */
export function getFailedItems(
  response: BulkUpsertResponse,
  originalItems: BulkUpsertItem[]
): Array<{
  item: BulkUpsertItem;
  status: 'conflict' | 'error';
  message?: string;
}> {
  return response.results
    .filter(r => r.status !== 'success')
    .map(r => ({
      item: originalItems[r.index],
      status: r.status as 'conflict' | 'error',
      message: r.message,
    }));
}
