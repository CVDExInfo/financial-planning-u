import { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { ensureCanRead, ensureCanWrite, getUserContext } from "../lib/auth";
import { bad, ok, noContent, serverError } from "../lib/http";
import { ddb, tableName, QueryCommand, ScanCommand, PutCommand, GetCommand } from "../lib/dynamo";
import { logError, logInfo } from "../utils/logging";
import { parseForecastBulkUpdate } from "../validation/allocations";

/**
 * Regex pattern to identify baseline-like IDs
 * Matches patterns like: base_, base-, BL-, BL_, baseline-, etc.
 */
const BASELINE_ID_PATTERN = /^(base_|base-|base|BL-|BL_)/i;

/**
 * Get project metadata from DynamoDB with composite key
 * Tries sk="METADATA" first, then falls back to sk="META" for legacy tables
 */
async function getMetadata(
  id: string,
  projectsTable: string,
  context?: { awsRequestId?: string }
): Promise<any> {
  try {
    // Try modern METADATA key first
    const item = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: `PROJECT#${id}`, sk: 'METADATA' },
      })
    );
    if (item.Item) return item.Item;
    
    // Legacy fallback for older tables
    const legacy = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: `PROJECT#${id}`, sk: 'META' },
      })
    );
    return legacy.Item ?? null;
  } catch (err: any) {
    console.error('Get project metadata failed', {
      requestId: context?.awsRequestId || 'unknown',
      projectId: id,
      table: projectsTable,
      error: err.name,
      message: err.message,
    });
    // Rethrow so caller can handle as 500/400
    throw err;
  }
}

/**
 * Get baseline metadata from DynamoDB
 * Retrieves baseline information including project_id for baseline->project resolution
 */
async function getBaselineMetadata(baselineId: string): Promise<any> {
  try {
    const prefacturasTable = tableName("prefacturas");
    const lookup = await ddb.send(
      new GetCommand({
        TableName: prefacturasTable,
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );
    return lookup.Item || null;
  } catch (err: any) {
    console.error('[allocations] Failed to get baseline metadata', {
      baselineId,
      error: err.name,
      message: err.message,
    });
    return null;
  }
}

/**
 * Coerce a value to a number, returning 0 if invalid
 */
function coerceNumber(v: any): number {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse month index from calendar key (YYYY-MM format)
 * 
 * NOTE: This extracts the calendar month number (1-12), NOT the contract month index.
 * For multi-year baselines, this is a fallback that loses contract month context.
 * Example: "2026-05" returns 5, but could represent M13 in a multi-year baseline.
 * 
 * The normalization logic prioritizes actual month_index/monthIndex fields when available.
 * This fallback is only used when those fields are missing and no numeric month is provided.
 */
function parseMonthIndexFromCalendarKey(calKey?: string): number | undefined {
  if (!calKey || typeof calKey !== 'string') return undefined;
  const m = calKey.match(/^\d{4}-(\d{2})$/);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

/**
 * Normalize allocations to canonical format and derive labour amounts when needed
 * 
 * This function:
 * 1. Normalizes field names (amount, month_index, etc.) from various legacy formats
 * 2. Derives labour monthly amounts from baseline when amount is 0
 * 3. Ensures all allocations have consistent shape for UI consumption
 * 
 * @param items - Raw allocation items from DynamoDB
 * @param baselineIdCandidate - Optional baseline ID to use for derivation
 * @returns Normalized allocation items
 */
async function normalizeAllocations(items: any[], baselineIdCandidate?: string): Promise<any[]> {
  const baselineCache: {[k:string]: any} = {};
  
  async function loadBaseline(bid: string) {
    if (!bid) return null;
    if (!baselineCache[bid]) baselineCache[bid] = await getBaselineMetadata(bid);
    return baselineCache[bid];
  }

  return Promise.all(items.map(async (it: any) => {
    // Canonicalize rubro/line item id
    const rubroId = it.rubroId || it.rubro_id || it.line_item_id || it.lineItemId || it.rubro || null;

    // Canonical amount: try multiple fields in priority order
    let amount = coerceNumber(
      it.amount ?? 
      it.planned ?? 
      it.monto_planeado ?? 
      it.monto_proyectado ?? 
      it.monto_real ?? 
      it.forecast
    );

    // Month indices / calendar key - now with robust normalization
    // Load projectStartDate for each item (via baseline metadata first, fallback to project metadata)
    let projectStartDate: string | undefined;

    // Prefer baseline to obtain start_date (baseline includes project info)
    const bidForMonth = it.baselineId || it.baseline_id || baselineIdCandidate;
    if (bidForMonth) {
      try {
        const baseline = await loadBaseline(bidForMonth);
        projectStartDate = baseline?.start_date || baseline?.payload?.start_date || baseline?.project_start_date;
        // baseline may also have durationMonths; we already use that elsewhere
      } catch (e) {
        // ignore; we'll try project metadata next
      }
    }

    // If still no projectStartDate, attempt to derive from the allocation's project key (PK=PROJECT#<id>)
    if (!projectStartDate) {
      let projectIdFromItem: string | undefined;
      if (it.PK) projectIdFromItem = String(it.PK).replace(/^PROJECT#/, "");
      else if (it.projectId) projectIdFromItem = it.projectId;
      else if (it.project_id) projectIdFromItem = it.project_id;
      if (projectIdFromItem) {
        try {
          const projectMeta = await getMetadata(projectIdFromItem, tableName("prefacturas"), /*context*/ undefined);
          projectStartDate = projectMeta?.start_date || projectMeta?.payload?.start_date;
        } catch (e) {
          // ignore
        }
      }
    }

    // Now compute monthIndex/calendarMonthKey robustly
    let monthIndex = undefined;
    let calendarMonthKey = it.calendarMonthKey ?? it.calendar_month ?? it.month ?? it.mes;
    if (calendarMonthKey) {
      try {
        const normalized = normalizeMonth(calendarMonthKey, projectStartDate);
        monthIndex = normalized.monthIndex;
        calendarMonthKey = normalized.calendarMonthKey;
      } catch (e) {
        // fallback to previous parsing logic if normalizeMonth throws
        monthIndex = parseMonthIndexFromCalendarKey(calendarMonthKey);
      }
    } else {
      // existing handling for numeric month inputs - unchanged
      monthIndex = it.month_index ?? it.monthIndex ?? (typeof it.month === 'number' ? it.month : undefined);
    }

    // If labour-like rubro and amount==0, try to derive from baseline labour estimates
    // Heuristic: checks if rubroId starts with "MOD" (case-insensitive)
    // This matches standard labour rubros like MOD-LEAD, MOD-SDM, MOD-ING, etc.
    // Note: If your taxonomy includes labour rubros that don't start with "MOD",
    // consider enhancing this to check against a canonical labour category list.
    const isMOD = /^MOD/i.test(String(rubroId));
    if (isMOD && !amount) {
      // Prefer explicit baselineId else fallback to provided candidate
      const bid = it.baselineId || it.baseline_id || baselineIdCandidate;
      if (bid) {
        try {
          const baseline = await loadBaseline(bid);
          if (baseline) {
            const laborEstimates = (baseline.labor_estimates || baseline.payload?.labor_estimates || baseline.payload?.payload?.labor_estimates) || [];
            // Attempt match by rubroId or line_item_id
            const matched = (laborEstimates || []).find((le: any) => {
              const leRubro = le.rubroId || le.rubro_id || le.line_item_id || le.id;
              return leRubro && String(leRubro).toLowerCase() === String(rubroId).toLowerCase();
            });
            if (matched) {
              // Derivation requires either:
              // 1) total_cost field (preferred), or
              // 2) hourly_rate + hours_per_month fields (fallback)
              // If neither is available, derivation is skipped and amount remains 0
              if (matched.total_cost || matched.totalCost) {
                const totalCost = coerceNumber(matched.total_cost ?? matched.totalCost);
                const duration = baseline.durationMonths || baseline.duration_months || matched.duration_months || matched.durationMonths || 12;
                if (duration > 0) amount = Math.round((totalCost / duration) * 100) / 100;
              } else if (matched.hourly_rate || matched.hourlyRate) {
                const hr = coerceNumber(matched.hourly_rate ?? matched.hourlyRate);
                const hours = coerceNumber(matched.hours_per_month ?? matched.hoursPerMonth ?? matched.hours ?? 160);
                const fte = coerceNumber(matched.fte_count ?? matched.fteCount ?? 1);
                const oncost = coerceNumber(matched.on_cost_percentage ?? matched.onCostPercentage ?? 0);
                const base = hr * hours * fte;
                amount = Math.round((base * (1 + oncost / 100)) * 100) / 100;
              }
              if (amount && amount > 0) {
                console.info(`[allocations] Derived amount=${amount} for labour rubro ${rubroId} from baseline ${bid}`);
              }
            }
          }
        } catch (e: any) {
          console.warn(`[allocations] Failed to derive labour amount for ${rubroId} / baseline ${bid}:`, e?.message || e);
        }
      }
    }

    return {
      ...it,
      amount,
      month_index: monthIndex,
      monthIndex,
      calendarMonthKey,
      rubroId,
      rubro_id: it.rubro_id ?? rubroId,
      line_item_id: it.line_item_id ?? it.lineItemId ?? rubroId,
    };
  }));
}

/**
 * Normalize month input to monthIndex (1-12) and compute calendarMonthKey (YYYY-MM)
 * Accepts:
 * - number 1-12 (monthIndex) - treated as contract month offset
 * - "YYYY-MM" string (calendar month key) - preserved as-is for backward compatibility
 * - "M1", "M2", etc. (M-notation) - treated as contract month offset
 * 
 * For numeric monthIndex and M-notation:
 *   - Computes calendarMonthKey by adding (monthIndex - 1) months to project start date
 *   - Example: project starts May 2025, monthIndex=1 → 2025-05, monthIndex=2 → 2025-06
 * 
 * For YYYY-MM format:
 *   - Preserved for backward compatibility with existing data
 *   - Extracts month number as monthIndex for internal consistency
 */
function normalizeMonth(
  monthInput: string | number,
  projectStartDate: string | undefined
): { monthIndex: number; calendarMonthKey: string } {
  let monthIndex: number;

  if (typeof monthInput === "number") {
    // Already a number, use as monthIndex (contract month)
    monthIndex = monthInput;
  } else if (typeof monthInput === "string") {
    // Check if it's in YYYY-MM format (explicit calendar month)
    if (/^\d{4}-\d{2}$/.test(monthInput)) {
      // If projectStartDate present, compute contract monthIndex as months since start + 1
      // This ensures multi-year baselines are mapped to M1..M60 unambiguously.
      if (projectStartDate && /^\d{4}-\d{2}-\d{2}$/.test(projectStartDate)) {
        const [calYear, calMonth] = monthInput.split('-').map(Number);
        // Parse start date with explicit UTC to avoid timezone issues
        const startDate = new Date(projectStartDate + 'T00:00:00.000Z');
        const startYear = startDate.getUTCFullYear();
        const startMonth = startDate.getUTCMonth() + 1; // 1-12
        // months difference = (calYear - startYear) * 12 + (calMonth - startMonth)
        const monthsDiff = (calYear - startYear) * 12 + (calMonth - startMonth);
        monthIndex = monthsDiff + 1; // M1 = start month
        // safety: allow up to 60
        if (monthIndex < 1 || monthIndex > 60) {
          // clamp, but also warn for unexpected large offsets
          console.warn(`[normalizeMonth] Computed monthIndex (${monthIndex}) outside [1..60] for calendar ${monthInput} with projectStartDate ${projectStartDate}. Clamping.`);
          monthIndex = Math.max(1, Math.min(60, monthIndex));
        }
        return {
          monthIndex,
          calendarMonthKey: monthInput
        };
      } else {
        // Backwards-compatible fallback when projectStartDate is missing:
        // Extract month-of-year - retains current behavior but logs a dev warning.
        const month = parseInt(monthInput.substring(5, 7), 10);
        console.warn(`[normalizeMonth] Received YYYY-MM ${monthInput} but no valid projectStartDate to compute contract month; falling back to month-of-year ${month}`);
        return {
          monthIndex: month,
          calendarMonthKey: monthInput
        };
      }
    }
    
    // Check if it's in "M1", "M2", etc. format
    const mMatch = monthInput.match(/^M(\d+)$/i);
    if (mMatch) {
      monthIndex = parseInt(mMatch[1], 10);
    } else {
      // Try to parse as number
      const parsed = parseInt(monthInput, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid month format: ${monthInput}`);
      }
      monthIndex = parsed;
    }
  } else {
    throw new Error(`Invalid month type: ${typeof monthInput}`);
  }

  // Allow contract month indices up to M60 (supports baselines with longer durations)
  if (monthIndex < 1 || monthIndex > 60) {
    throw new Error(`Month index must be between 1 and 60, got: ${monthIndex}`);
  }

  // Compute calendarMonthKey from projectStartDate + (monthIndex - 1) months
  let calendarMonthKey: string;
  if (projectStartDate && /^\d{4}-\d{2}-\d{2}$/.test(projectStartDate)) {
    // Parse start date with explicit UTC to avoid timezone issues
    const startDate = new Date(projectStartDate + 'T00:00:00.000Z');
    // Use Date.UTC to avoid timezone issues when computing future dates
    const startYear = startDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth();
    const futureDate = new Date(Date.UTC(startYear, startMonth + (monthIndex - 1), 1));
    const year = futureDate.getUTCFullYear();
    const month = String(futureDate.getUTCMonth() + 1).padStart(2, "0");
    calendarMonthKey = `${year}-${month}`;
  } else {
    // If no valid project start date, use a fixed reference year (2020) to avoid
    // generating time-dependent calendar keys that would change over time
    console.warn(
      `[allocations] Missing or invalid project start date: ${projectStartDate}. Using fixed reference year 2020 for monthIndex ${monthIndex}.`
    );
    const referenceYear = 2020;
    calendarMonthKey = `${referenceYear}-${String(monthIndex).padStart(2, "0")}`;
  }

  return { monthIndex, calendarMonthKey };
}

/**
 * GET /allocations
 * Returns allocations from DynamoDB, filtered by projectId and optionally by baselineId
 * Always returns an array (never {data: []}) for frontend compatibility
 * 
 * Query parameters:
 * - projectId (required): The project ID
 * - baseline or baselineId (optional): Filter allocations by baseline
 * 
 * Robust retrieval with SK filtering:
 * 1. Primary: query pk=PROJECT#${projectId} + sk begins_with ALLOCATION#${baselineId}#
 * 2. Fallback 1: If baselineId-like projectId, resolve baseline→project
 * 3. Fallback 2: Try BASELINE#${baselineId} for legacy allocations
 * 
 * Tracks all attempted keys for diagnostics
 */
async function getAllocations(event: APIGatewayProxyEventV2) {
  try {
    await ensureCanRead(event as any);
    
    const rawProjectId = 
      event.queryStringParameters?.projectId || 
      event.queryStringParameters?.project_id;
    
    const baselineId = 
      event.queryStringParameters?.baseline ||
      event.queryStringParameters?.baselineId;
    
    // Normalize projectId: strip PROJECT# prefix if present
    let incomingId = rawProjectId;
    if (incomingId && incomingId.startsWith('PROJECT#')) {
      incomingId = incomingId.substring('PROJECT#'.length);
      console.log(`[allocations] Normalized projectId from ${rawProjectId} to ${incomingId}`);
    }
    
    const allocationsTable = tableName("allocations");
    
    // Track all attempted partition keys and their results for diagnostics
    const triedKeys: Array<{ key: string; count: number; skPrefix?: string }> = [];
    
    // Helper function to query by partition key with optional SK filter
    async function queryByPK(pk: string, skPrefix?: string): Promise<any[]> {
      const params: any = {
        TableName: allocationsTable,
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#month": "month", // 'month' is a reserved word in DynamoDB
        },
        ExpressionAttributeValues: {
          ":pk": pk,
        },
        // Return only fields needed by UI to avoid oversized responses
        // Note: 'mes' is legacy Spanish field, 'month' is English equivalent (both kept for compatibility)
        ProjectionExpression: "pk, sk, projectId, baselineId, baseline_id, rubroId, rubro_id, line_item_id, #month, mes, monthIndex, month_index, calendarMonthKey, amount, planned, forecast, actual, monto_planeado, monto_proyectado, monto_real",
      };
      
      if (skPrefix) {
        // Filter by SK prefix to get only ALLOCATION# items for this baseline
        params.KeyConditionExpression = "#pk = :pk AND begins_with(sk, :skPrefix)";
        params.ExpressionAttributeNames["#sk"] = "sk";
        params.ExpressionAttributeValues[":skPrefix"] = skPrefix;
      } else {
        // Query by PK only (less efficient, may return non-allocation items)
        params.KeyConditionExpression = "#pk = :pk";
      }
      
      const queryResult = await ddb.send(new QueryCommand(params));
      
      const items = queryResult.Items || [];
      
      // Filter to ensure we only return ALLOCATION# items (defense in depth)
      const allocations = items.filter(item => 
        item.sk && typeof item.sk === 'string' && item.sk.startsWith('ALLOCATION#')
      );
      
      triedKeys.push({ key: pk, count: allocations.length, skPrefix });
      
      console.log(`[allocations] Query: pk=${pk}, skPrefix=${skPrefix || 'none'}, found=${allocations.length} allocations`);
      
      return allocations;
    }
    
    // If projectId is provided, use robust retrieval with SK filtering
    if (incomingId) {
      // Check if incoming ID looks like a baseline ID
      const isBaselineLike = BASELINE_ID_PATTERN.test(incomingId);
      
      // Primary attempt: query PROJECT#${incomingId} with SK filter if baselineId provided
      let pkCandidate = `PROJECT#${incomingId}`;
      let skPrefix = baselineId ? `ALLOCATION#${baselineId}#` : undefined;
      
      let items = await queryByPK(pkCandidate, skPrefix);
      
      if (items.length > 0) {
        logInfo(`[allocations] ✅ Found ${items.length} allocations by ${pkCandidate}${skPrefix ? ` with SK filter ${skPrefix}` : ''}`);
        const normalized = await normalizeAllocations(items, baselineId);
        return ok(event, normalized);
      }
      
      // If no baselineId was provided but we got 0 results, try to derive baselineId from project
      if (!baselineId && !isBaselineLike) {
        console.log(`[allocations] No results with pk=${pkCandidate}, no baselineId provided. Trying to derive from project metadata...`);
        
        try {
          const projectsTable = tableName("projects");
          const projectMeta = await ddb.send(
            new GetCommand({
              TableName: projectsTable,
              Key: { pk: `PROJECT#${incomingId}`, sk: 'METADATA' },
            })
          );
          
          if (projectMeta.Item) {
            const derivedBaselineId = projectMeta.Item.baseline_id || projectMeta.Item.baselineId;
            if (derivedBaselineId) {
              console.log(`[allocations] Derived baselineId=${derivedBaselineId} from project metadata`);
              skPrefix = `ALLOCATION#${derivedBaselineId}#`;
              items = await queryByPK(pkCandidate, skPrefix);
              
              if (items.length > 0) {
                logInfo(`[allocations] ✅ Found ${items.length} allocations using derived baselineId ${derivedBaselineId}`);
                const normalized = await normalizeAllocations(items, derivedBaselineId);
                return ok(event, normalized);
              }
            }
          }
        } catch (metaErr: any) {
          console.warn(`[allocations] Failed to derive baselineId from project metadata:`, metaErr.message);
        }
      }
      
      // Fallback 1: If incomingId is baseline-like, try to resolve baseline → project
      if (isBaselineLike) {
        console.log(`[allocations] ID appears baseline-like: ${incomingId}, attempting baseline→project resolution`);
        
        try {
          const baseline = await getBaselineMetadata(incomingId);
          if (baseline) {
            const resolvedProjectId = baseline.project_id || baseline.projectId;
            if (resolvedProjectId) {
              pkCandidate = `PROJECT#${resolvedProjectId}`;
              skPrefix = `ALLOCATION#${incomingId}#`; // Use the baselineId for SK filter
              items = await queryByPK(pkCandidate, skPrefix);
              
              if (items.length > 0) {
                logInfo(`[allocations] ✅ Found ${items.length} allocations via baseline→project resolution: ${pkCandidate} with baselineId ${incomingId}`);
                const normalized = await normalizeAllocations(items, incomingId);
                return ok(event, normalized);
              }
            } else {
              console.warn(`[allocations] Baseline ${incomingId} has no project_id`);
            }
          } else {
            console.warn(`[allocations] Baseline ${incomingId} not found for resolution`);
          }
        } catch (err: any) {
          console.warn(`[allocations] Baseline→project lookup failed for ${incomingId}:`, err.message);
        }
        
        // Fallback 2: Try querying by BASELINE# pk (legacy format)
        pkCandidate = `BASELINE#${incomingId}`;
        skPrefix = `ALLOCATION#${incomingId}#`;
        items = await queryByPK(pkCandidate, skPrefix);
        
        if (items.length > 0) {
          logInfo(`[allocations] ✅ Found ${items.length} allocations by legacy baseline pk: ${pkCandidate}`);
          const normalized = await normalizeAllocations(items, incomingId);
          return ok(event, normalized);
        }
      }
      
      // No allocations found - log diagnostic info and return empty array
      console.warn(`[allocations] ⚠️ No allocations found for projectId=${incomingId}, baselineId=${baselineId || 'none'}`, {
        triedKeys,
        isBaselineLike,
      });
      
      return ok(event, []);
    }
    
    // No projectId - return all allocations with pagination limit
    const limit = 1000; // Reasonable limit to avoid timeouts
    const scanResult = await ddb.send(
      new ScanCommand({
        TableName: allocationsTable,
        Limit: limit,
      })
    );
    
    const items = scanResult.Items || [];
    console.log(`[allocations] GET scan (all projects): ${items.length} items (limit: ${limit})`);
    
    // Normalize items before returning
    const normalized = await normalizeAllocations(items);
    
    // Return bare array for frontend compatibility
    return ok(event, normalized);
  } catch (error) {
    logError("Error fetching allocations", error);
    return serverError(event as any, "Failed to fetch allocations");
  }
}

/**
 * PUT /projects/{id}/allocations:bulk?type=planned|forecast
 * Bulk update allocations for a project
 * Supports both planned and forecast allocations via type query parameter
 * 
 * Authorization:
 * - planned: Requires write access (PMO, SDMT, SDM)
 * - forecast: Requires SDMT or ADMIN role
 */
async function bulkUpdateAllocations(event: APIGatewayProxyEventV2) {
  const requestId = event.requestContext?.requestId || 'unknown';
  
  // Get allocation type from query parameter (default to 'planned')
  // Declare outside try block so it's accessible in catch block for logging
  const allocationType = event.queryStringParameters?.type || "planned";
  
  try {
    const projectId = event.pathParameters?.id;
    if (!projectId) {
      return bad(event, "Missing project id");
    }
    
    console.log(`[allocations] ${requestId} - ${allocationType} bulk update for project ${projectId}`);
    
    if (allocationType !== "planned" && allocationType !== "forecast") {
      return bad(event, "Invalid type parameter. Must be 'planned' or 'forecast'");
    }

    // Authorization check based on type
    if (allocationType === "forecast") {
      // Forecast updates require SDMT, EXEC_RO, or ADMIN role
      const userContext = await getUserContext(event as any);
      const hasAccess = userContext.isSDMT || userContext.isExecRO || userContext.isAdmin;
      
      if (!hasAccess) {
        return {
          statusCode: 403,
          body: JSON.stringify({ message: "Forbidden: SDMT, EXEC_RO, or ADMIN role required for forecast updates" }),
          headers: { "Content-Type": "application/json" },
        };
      }
    } else {
      // Planned allocations require standard write access
      await ensureCanWrite(event as any);
    }

    // Parse request body - support both old "allocations" and new "items" formats
    // Old format: {allocations: [{rubro_id, mes, monto_planeado/monto_proyectado}]}
    // New format: {items: [{rubroId, month, forecast/planned}]}
    const body = event.body ? JSON.parse(event.body) : {};
    const allocations = body.allocations || body.items;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return bad(event, "Missing or invalid allocations/items array");
    }

    // Get user context for audit
    const userContext = await getUserContext(event as any);
    const updatedBy = userContext.email || userContext.sub || "system";
    const timestamp = new Date().toISOString();

    // Get project metadata (baseline_id and start_date)
    // Use composite key with sk: 'METADATA' for proper data access
    const projectsTable = tableName("projects");
    let projectResult = await ddb.send(
      new GetCommand({
        TableName: projectsTable,
        Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
      })
    );

    // Fallback to legacy sk: 'META' for backward compatibility
    if (!projectResult.Item) {
      console.warn(`[allocations] Project ${projectId} not found with sk=METADATA, trying legacy sk=META`);
      projectResult = await ddb.send(
        new GetCommand({
          TableName: projectsTable,
          Key: { pk: `PROJECT#${projectId}`, sk: "META" },
        })
      );
    }

    // Return 400 (Bad Request) instead of generic error if project not found
    if (!projectResult.Item) {
      console.error(`[allocations] Project ${projectId} metadata not found in projects table`);
      return bad(event, `Project metadata not found for project ${projectId}. Ensure the project exists and has been properly initialized.`);
    }

    const project = projectResult.Item;
    const baselineId = project.baseline_id || project.baselineId || "default";
    const projectStartDate = 
      project.start_date || 
      project.fecha_inicio || 
      project.startDate;

    console.log(
      `[allocations] ${requestId} - Project metadata: baselineId=${baselineId}, startDate=${projectStartDate}`
    );

    // Normalize allocation items to handle both formats and compute calendar months
    let normalizedAllocations: Array<{ 
      rubro_id: string; 
      monthIndex: number;
      calendarMonthKey: string;
      amount: number;
    }>;
    try {
      normalizedAllocations = allocations.map((item: any, index: number) => {
        // Support both formats:
        // - Legacy: {rubro_id, mes, monto_planeado/monto_proyectado}
        // - New: {rubroId, month, forecast/planned}
        const rubroId = item.rubro_id || item.rubroId;
        const monthInput = item.mes || item.month;
        
        if (!rubroId) {
          throw new Error(`Allocation at index ${index}: missing rubro_id/rubroId`);
        }
        
        if (monthInput === undefined || monthInput === null) {
          throw new Error(`Allocation at index ${index}: missing mes/month`);
        }
        
        // Get amount based on type and format
        let amount: number;
        if (allocationType === "forecast") {
          amount = item.monto_proyectado ?? item.forecast;
        } else {
          amount = item.monto_planeado ?? item.planned;
        }
        
        if (typeof amount !== "number" || amount < 0) {
          throw new Error(`Allocation at index ${index}: invalid amount (must be >= 0)`);
        }

        // Normalize month to monthIndex and compute calendarMonthKey
        const { monthIndex, calendarMonthKey } = normalizeMonth(monthInput, projectStartDate);
        
        return {
          rubro_id: rubroId,
          monthIndex,
          calendarMonthKey,
          amount,
        };
      });
    } catch (error: any) {
      console.error(`[allocations] ${requestId} - Validation error:`, error.message);
      return bad(event, error.message || "Invalid allocation format");
    }

    // Process each allocation (idempotent writes)
    const allocationsTable = tableName("allocations");
    const results = [];

    for (const allocation of normalizedAllocations) {
      const { rubro_id, monthIndex, calendarMonthKey, amount } = allocation;

      // Create composite sort key: ALLOCATION#{baselineId}#{calendarMonthKey}#{rubroId}
      // Using calendarMonthKey (YYYY-MM) in the key ensures proper ordering and grouping
      const sk = `ALLOCATION#${baselineId}#${calendarMonthKey}#${rubro_id}`;
      const pk = `PROJECT#${projectId}`;

      // Check if allocation exists
      const existingResult = await ddb.send(
        new GetCommand({
          TableName: allocationsTable,
          Key: { pk, sk },
        })
      );

      const existing = existingResult.Item || {};

      // Merge with existing data to preserve other fields
      const item = {
        ...existing,
        pk,
        sk,
        projectId,
        baselineId,
        rubroId: rubro_id,
        monthIndex, // Store numeric month index (1-12)
        month: calendarMonthKey, // Store calendar month key (YYYY-MM)
        mes: calendarMonthKey, // Legacy field compatibility
        calendarMonthKey, // Explicit field for clarity
        // Update the appropriate field based on type
        ...(allocationType === "planned" 
          ? { 
              monto_planeado: amount,
              planned: amount, // Also set the English field for compatibility
            }
          : { 
              monto_proyectado: amount,
              forecast: amount, // Also set the English field for compatibility
            }
        ),
        lastUpdated: timestamp,
        updatedBy,
        // Preserve other fields if they exist
        actual: existing.actual,
        monto_real: existing.monto_real,
      };

      // Write to DynamoDB (idempotent)
      await ddb.send(
        new PutCommand({
          TableName: allocationsTable,
          Item: item,
        })
      );

      results.push({
        rubro_id,
        monthIndex,
        calendarMonthKey,
        mes: calendarMonthKey, // For backward compatibility
        // Include both the amount and the specific field for backward compatibility
        ...(allocationType === "forecast" 
          ? { monto_proyectado: amount, forecast: amount }
          : { monto_planeado: amount, planned: amount }
        ),
        status: existing.pk ? "updated" : "created",
      });

      console.log(
        `[allocations] ${allocationType} ${existing.pk ? "updated" : "created"}: ${projectId} / ${rubro_id} / M${monthIndex} (${calendarMonthKey}) = ${amount}`
      );
    }

    console.log(`[allocations] ${requestId} - Successfully processed ${results.length} ${allocationType} allocations for project ${projectId}`);

    return ok(event, {
      updated_count: results.length,
      type: allocationType,
      allocations: results,
    });
  } catch (error: any) {
    // Handle authorization errors specifically
    if (error?.statusCode === 403) {
      console.log(`[allocations] 403 Forbidden - ${allocationType} update rejected for user`);
      return {
        statusCode: 403,
        body: JSON.stringify({ message: error.body || "Forbidden" }),
        headers: { "Content-Type": "application/json" },
      };
    }
    
    // Handle validation errors (should already be caught above, but be defensive)
    if (error?.statusCode === 400 || error.message?.includes("invalid") || error.message?.includes("Invalid")) {
      console.log(`[allocations] 400 Bad Request - ${error.message || "Invalid payload"}`);
      return bad(event, error.message || "Invalid allocation data");
    }
    
    // Log unexpected errors with context
    console.error(`[allocations] Unexpected error during ${allocationType} bulk update for project ${event.pathParameters?.id}:`, error);
    logError("Error bulk updating allocations", error);
    return serverError(event as any, "Failed to update allocations");
  }
}

export const handler = async (event: APIGatewayProxyEventV2, context?: Context) => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return noContent(event);
  }

  if (method === "GET") {
    return await getAllocations(event);
  }

  if (method === "PUT") {
    return await bulkUpdateAllocations(event);
  }

  return bad(event, `Method ${method} not allowed`, 405);
};
