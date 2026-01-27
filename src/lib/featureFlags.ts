/**
 * Feature Flags Utility
 * 
 * Provides a consistent way to read and evaluate feature flags from environment variables.
 * Supports both V2-specific flags and legacy flags for backward compatibility.
 */

/**
 * Type definition for Vite environment variables
 */
interface ImportMetaEnv {
  [key: string]: string | boolean | undefined;
}

/**
 * Check if a feature flag is enabled
 * 
 * @param flagV2Name - The V2 feature flag name (takes precedence)
 * @param legacyName - Optional legacy flag name for backward compatibility
 * @returns true if the flag is enabled, false otherwise
 */
export function isFeatureEnabled(flagV2Name: string, legacyName?: string): boolean {
  const env = import.meta.env as ImportMetaEnv;
  
  // Check V2-specific flag first
  if (typeof env[flagV2Name] !== 'undefined' && env[flagV2Name] !== null) {
    return String(env[flagV2Name]).toLowerCase() === 'true';
  }
  
  // Fall back to legacy flag if provided
  if (legacyName && typeof env[legacyName] !== 'undefined' && env[legacyName] !== null) {
    return String(env[legacyName]).toLowerCase() === 'true';
  }
  
  return false;
}

/**
 * Get a feature flag value as a string
 * 
 * @param flagName - The feature flag name
 * @param defaultValue - Default value if flag is not set
 * @returns The flag value as a string
 */
export function getFeatureFlagValue(flagName: string, defaultValue = ''): string {
  const env = import.meta.env as ImportMetaEnv;
  return String(env[flagName] ?? defaultValue);
}

/**
 * Check if multiple feature flags are all enabled
 * 
 * @param flagNames - Array of feature flag names
 * @returns true if all flags are enabled, false otherwise
 */
export function areAllFeaturesEnabled(flagNames: string[]): boolean {
  return flagNames.every(flagName => isFeatureEnabled(flagName));
}

/**
 * Check if any of the feature flags are enabled
 * 
 * @param flagNames - Array of feature flag names
 * @returns true if any flag is enabled, false otherwise
 */
export function isAnyFeatureEnabled(flagNames: string[]): boolean {
  return flagNames.some(flagName => isFeatureEnabled(flagName));
}
