/**
 * Project label formatting utilities
 * 
 * Provides consistent, configurable formatting for project display across
 * the application (dropdowns, selectors, tables, etc.)
 */

export type ProjectLabelMode = "id-only" | "name-only" | "id-and-name";

export interface ProjectLike {
  id: string;
  code?: string | null;
  name?: string | null;
  client?: string | null;
}

/**
 * Format a project into a user-friendly label for display in dropdowns,
 * selectors, and other UI components.
 * 
 * @param project - Project object with id, code, name, and optionally client
 * @param mode - Display mode:
 *   - "id-only": Show only the code/ID
 *   - "name-only": Show only the name (fallback to code/ID if name missing)
 *   - "id-and-name": Show "code – name" format (default, recommended)
 * @returns Formatted label string
 * 
 * @example
 * ```ts
 * const project = { id: "P-123", code: "P-123", name: "Mobile App" };
 * 
 * formatProjectLabel(project, "id-only")      // "P-123"
 * formatProjectLabel(project, "name-only")    // "Mobile App"
 * formatProjectLabel(project, "id-and-name")  // "P-123 – Mobile App"
 * ```
 */
export function formatProjectLabel(
  project: ProjectLike,
  mode: ProjectLabelMode = "id-and-name",
): string {
  // Prefer code over id for display (code is the user-friendly identifier)
  const code = (project.code?.trim() || project.id?.trim() || "").trim();
  const name = (project.name?.trim() || "").trim();

  if (mode === "id-only") {
    return code || project.id || "Unknown";
  }

  if (mode === "name-only") {
    return name || code || project.id || "Unknown Project";
  }

  // Default: "id-and-name" mode
  if (code && name) {
    return `${code} – ${name}`;
  }

  // Fallback if one is missing
  return code || name || project.id || "Unknown Project";
}

/**
 * Format a project label with optional client information
 * 
 * @param project - Project object with id, code, name, and client
 * @param mode - Display mode for project info
 * @param includeClient - Whether to append client name in parentheses
 * @returns Formatted label with optional client
 * 
 * @example
 * ```ts
 * const project = { 
 *   id: "P-123", 
 *   code: "P-123", 
 *   name: "Mobile App", 
 *   client: "ACME Corp" 
 * };
 * 
 * formatProjectLabelWithClient(project, "id-and-name", true)
 * // "P-123 – Mobile App (ACME Corp)"
 * ```
 */
export function formatProjectLabelWithClient(
  project: ProjectLike,
  mode: ProjectLabelMode = "id-and-name",
  includeClient: boolean = false,
): string {
  const baseLabel = formatProjectLabel(project, mode);
  
  if (includeClient && project.client?.trim()) {
    return `${baseLabel} (${project.client.trim()})`;
  }
  
  return baseLabel;
}

/**
 * Get the display code for a project (prefers code field, falls back to id)
 * 
 * @param project - Project object
 * @returns The code to display
 */
export function getProjectCode(project: ProjectLike): string {
  return project.code?.trim() || project.id?.trim() || "";
}

/**
 * Get the display name for a project (with fallback)
 * 
 * @param project - Project object
 * @returns The name to display
 */
export function getProjectName(project: ProjectLike): string {
  return project.name?.trim() || "Unnamed Project";
}
