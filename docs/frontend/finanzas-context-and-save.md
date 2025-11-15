# Finanzas Context and Save - Frontend Architecture

## Overview

This document describes the client-side architecture for the Finanzas SD module, focusing on:
1. Project context management and data invalidation
2. SaveBar component for consistent save UX
3. Mock data control for development vs. production environments

## ProjectContext

### Purpose

`ProjectContext` is the **single source of truth** for project-scoped state across the Finanzas application. It ensures that all components have access to the current project information and that data is properly invalidated when the project changes.

### Key Properties

```typescript
interface ProjectContextType {
  selectedProjectId: string;        // Current project ID
  setSelectedProjectId: (id: string) => void;
  selectedPeriod: string;           // Period in months (e.g., "12", "24", "48")
  setSelectedPeriod: (period: string) => void;
  currentProject: Project | undefined; // Full project object
  projects: Project[];              // All available projects
  loading: boolean;                 // Loading state
  refreshProject: () => Promise<void>;
  projectChangeCount: number;       // Incremented on every project change
  periodChangeCount: number;        // Incremented on every period change
  baselineId: string;               // Current project's baseline ID
  invalidateProjectData: () => void; // Manual data invalidation
}
```

### Usage

```tsx
import { useProject } from '@/contexts/ProjectContext';

function MyComponent() {
  const { 
    selectedProjectId, 
    currentProject, 
    projectChangeCount 
  } = useProject();
  
  useEffect(() => {
    // Reload data when project changes
    loadData(selectedProjectId);
  }, [selectedProjectId, projectChangeCount]);
}
```

### Data Invalidation

When the project changes:
1. `projectChangeCount` is incremented
2. All components using this value in their `useEffect` dependencies will re-run
3. This triggers data refetching with the new project ID

Components should:
- Include `selectedProjectId` and `projectChangeCount` in `useEffect` dependencies
- Call API methods with `selectedProjectId` to fetch project-scoped data

### Manual Invalidation

To force a data refresh without changing the project:

```tsx
const { invalidateProjectData } = useProject();

// After a mutation that affects multiple views
await saveChanges();
invalidateProjectData(); // Forces all dependent components to reload
```

## SaveBar Component

### Purpose

`SaveBar` provides a consistent save experience across editable views. It handles the save lifecycle and displays appropriate feedback to users.

### State Machine

```
idle → dirty → saving → success → idle
                  ↓
                error → dirty
```

- **idle**: No unsaved changes
- **dirty**: Changes exist that need to be saved
- **saving**: Save operation in progress (buttons disabled)
- **success**: Save completed successfully (auto-hides after 3s)
- **error**: Save failed (user can retry)

### Usage

```tsx
import { SaveBar, SaveBarState } from '@/components/SaveBar';

function EditableView() {
  const [saveState, setSaveState] = useState<SaveBarState>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  
  const handleSave = async () => {
    setSaveState('saving');
    try {
      await ApiService.saveData(formData);
      setSaveState('success');
      setHasChanges(false);
      
      // Auto-transition to idle after success
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (error) {
      setSaveState('error');
    }
  };
  
  const handleCancel = () => {
    // Revert changes
    resetForm();
    setHasChanges(false);
    setSaveState('idle');
  };
  
  return (
    <>
      {/* Your form/editable content */}
      <form onChange={() => {
        setHasChanges(true);
        setSaveState('dirty');
      }}>
        {/* ... */}
      </form>
      
      <SaveBar
        state={saveState}
        isDirty={hasChanges}
        onSave={handleSave}
        onSaveAndClose={async () => {
          await handleSave();
          navigate('/back');
        }}
        onCancel={handleCancel}
        errorMessage="Failed to save changes"
        showSaveAndClose={true}
        showCancel={true}
      />
    </>
  );
}
```

## Logger Utility

### Purpose

Centralized logging with environment-aware behavior to avoid console spam in production.

### Usage

```tsx
import { logger } from '@/utils/logger';

// Development only
logger.debug('Detailed debugging info', { data });
logger.info('General information', value);

// Both development and production
logger.warn('Warning message', context);
logger.error('Error occurred', error, correlationId);
```

### Log Levels by Environment

| Level | Development | Production |
|-------|------------|------------|
| debug | ✅ Shown   | ❌ Hidden  |
| info  | ✅ Shown   | ❌ Hidden  |
| warn  | ✅ Shown   | ✅ Shown   |
| error | ✅ Shown   | ✅ Shown   |

## Mock Data Control

### Environment Behavior

Mock data fallbacks are **only available in development mode** with an explicit flag:

```typescript
// Will only return mock data if BOTH conditions are true:
const shouldUseMockData = () => {
  return import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';
};
```

### Development Mode

Set in `.env.local`:
```bash
VITE_USE_MOCKS=true
```

This enables mock data fallbacks when API calls fail or for unknown projects.

### Production Mode

In production builds:
- `import.meta.env.DEV` is `false`
- Mock data is **never** used, regardless of `VITE_USE_MOCKS`
- Empty arrays/empty states are returned when data is unavailable
- Users see "No data configured" messages instead of default data

## References

- Logger: `/src/utils/logger.ts`
- SaveBar: `/src/components/SaveBar.tsx`
- ErrorBoundary: `/src/components/ErrorBoundary.tsx`
- ProjectContext: `/src/contexts/ProjectContext.tsx`
- API Service: `/src/lib/api.ts`
