/**
 * SaveBar Component
 * 
 * A reusable bottom bar component that manages save state lifecycle:
 * - idle: No unsaved changes
 * - dirty: Changes exist that need to be saved
 * - saving: Save operation in progress
 * - success: Save completed successfully
 * - error: Save failed
 * 
 * Usage:
 *   <SaveBar
 *     state="dirty"
 *     onSave={() => handleSave()}
 *     onSaveAndClose={() => handleSaveAndClose()}
 *     onCancel={() => handleCancel()}
 *     isDirty={hasUnsavedChanges}
 *   />
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveBarState = 'idle' | 'dirty' | 'saving' | 'success' | 'error';

interface SaveBarProps {
  /** Current state of the save operation */
  state: SaveBarState;
  
  /** Whether there are unsaved changes (alternative to state === 'dirty') */
  isDirty?: boolean;
  
  /** Callback for save action */
  onSave: () => void | Promise<void>;
  
  /** Optional callback for save and close action */
  onSaveAndClose?: () => void | Promise<void>;
  
  /** Optional callback for cancel action */
  onCancel?: () => void;
  
  /** Optional error message to display */
  errorMessage?: string;
  
  /** Optional success message (defaults to "Changes saved successfully") */
  successMessage?: string;
  
  /** Whether to show the save and close button */
  showSaveAndClose?: boolean;
  
  /** Whether to show the cancel button */
  showCancel?: boolean;
  
  /** Custom className for the container */
  className?: string;
}

export function SaveBar({
  state,
  isDirty = false,
  onSave,
  onSaveAndClose,
  onCancel,
  errorMessage,
  successMessage = 'Changes saved successfully',
  showSaveAndClose = true,
  showCancel = true,
  className,
}: SaveBarProps) {
  // Determine if bar should be visible
  const isVisible = state !== 'idle' || isDirty;
  const isSaving = state === 'saving';
  const isSuccess = state === 'success';
  const isError = state === 'error';
  
  // Auto-hide success state after 3 seconds
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        // Parent component should handle transitioning to idle
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg transition-transform duration-300',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        {/* Status message */}
        <div className="flex items-center gap-2">
          {isSaving && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Saving changes...
              </span>
            </>
          )}
          
          {isSuccess && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">
                {successMessage}
              </span>
            </>
          )}
          
          {isError && (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {errorMessage || 'Failed to save changes. Please try again.'}
              </span>
            </>
          )}
          
          {!isSaving && !isSuccess && !isError && (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-muted-foreground">
                You have unsaved changes
              </span>
            </>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {showCancel && onCancel && !isSaving && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isSaving || isSuccess}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
          
          {showSaveAndClose && onSaveAndClose && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSaveAndClose}
              disabled={isSaving || isSuccess}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save & Close
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
