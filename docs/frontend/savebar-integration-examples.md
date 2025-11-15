# SaveBar Integration Examples

This document provides practical examples of integrating the SaveBar component into various Finanzas screens.

## Example 1: Forecast Grid with Inline Editing

```tsx
import { useState, useEffect } from 'react';
import { SaveBar, SaveBarState } from '@/components/SaveBar';
import { useProject } from '@/contexts/ProjectContext';
import ApiService from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export function ForecastGrid() {
  const { selectedProjectId } = useProject();
  const [forecastData, setForecastData] = useState([]);
  const [changedCells, setChangedCells] = useState(new Map());
  const [saveState, setSaveState] = useState<SaveBarState>('idle');

  const handleCellEdit = (lineItemId: string, month: number, value: number) => {
    // Mark cell as changed
    const key = `${lineItemId}-${month}`;
    setChangedCells(prev => new Map(prev).set(key, value));
    setSaveState('dirty');
  };

  const handleSave = async () => {
    if (changedCells.size === 0) return;

    setSaveState('saving');
    try {
      // Convert changed cells to update payload
      const updates = Array.from(changedCells.entries()).map(([key, value]) => {
        const [line_item_id, month] = key.split('-');
        return {
          line_item_id,
          month: parseInt(month),
          forecast: value,
        };
      });

      await ApiService.updateForecast(selectedProjectId, updates);
      
      setChangedCells(new Map());
      setSaveState('success');
      toast.success('Forecast updated successfully');
      
      // Auto-transition to idle after 3 seconds
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (error) {
      logger.error('Failed to save forecast:', error);
      setSaveState('error');
      toast.error('Failed to save forecast changes');
    }
  };

  const handleCancel = () => {
    setChangedCells(new Map());
    setSaveState('idle');
    // Reload original data
    loadForecastData();
  };

  return (
    <div>
      {/* Your forecast grid with editable cells */}
      <ForecastTable
        data={forecastData}
        onCellEdit={handleCellEdit}
      />

      <SaveBar
        state={saveState}
        isDirty={changedCells.size > 0}
        onSave={handleSave}
        onCancel={handleCancel}
        showSaveAndClose={false}
      />
    </div>
  );
}
```

## Example 2: Handoff Form

```tsx
import { useState } from 'react';
import { SaveBar, SaveBarState } from '@/components/SaveBar';
import { useNavigate } from 'react-router-dom';
import ApiService from '@/lib/api';
import { toast } from 'sonner';

export function HandoffForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    baselineId: '',
    modTotal: 0,
    laborPercentage: 0,
    acceptedBy: '',
  });
  const [saveState, setSaveState] = useState<SaveBarState>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveState('dirty');
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await ApiService.handoffBaseline(projectId, {
        baseline_id: formData.baselineId,
        mod_total: formData.modTotal,
        pct_ingenieros: formData.laborPercentage,
        pct_sdm: 100 - formData.laborPercentage,
        aceptado_por: formData.acceptedBy,
      });

      setSaveState('success');
      setHasChanges(false);
      toast.success('Baseline handed off successfully');

      setTimeout(() => setSaveState('idle'), 3000);
    } catch (error) {
      setSaveState('error');
      toast.error('Failed to handoff baseline');
    }
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    if (saveState === 'success') {
      navigate('/sdmt/cost/catalog');
    }
  };

  return (
    <form>
      {/* Form fields */}
      <input
        value={formData.baselineId}
        onChange={(e) => handleFormChange('baselineId', e.target.value)}
      />
      {/* More fields... */}

      <SaveBar
        state={saveState}
        isDirty={hasChanges}
        onSave={handleSave}
        onSaveAndClose={handleSaveAndClose}
        showSaveAndClose={true}
      />
    </form>
  );
}
```

## Example 3: Catalog Bulk Edit

```tsx
import { useState } from 'react';
import { SaveBar, SaveBarState } from '@/components/SaveBar';
import ApiService from '@/lib/api';
import { toast } from 'sonner';

export function CatalogBulkEdit() {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkChanges, setBulkChanges] = useState({
    category: '',
    costCenter: '',
    indexationPolicy: '',
  });
  const [saveState, setSaveState] = useState<SaveBarState>('idle');

  const handleApplyBulkChanges = async () => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    setSaveState('saving');
    try {
      // Apply changes to all selected items
      await Promise.all(
        selectedItems.map(itemId =>
          ApiService.updateLineItem(itemId, bulkChanges)
        )
      );

      setSaveState('success');
      toast.success(`Updated ${selectedItems.length} items`);
      
      setTimeout(() => {
        setSaveState('idle');
        setSelectedItems([]);
      }, 3000);
    } catch (error) {
      setSaveState('error');
      toast.error('Failed to apply bulk changes');
    }
  };

  return (
    <div>
      {/* Bulk edit form */}
      <div>
        <label>Apply to {selectedItems.length} selected items:</label>
        <select
          value={bulkChanges.category}
          onChange={(e) => {
            setBulkChanges(prev => ({ ...prev, category: e.target.value }));
            setSaveState('dirty');
          }}
        >
          <option value="">Select category...</option>
          {/* Options */}
        </select>
      </div>

      <SaveBar
        state={saveState}
        isDirty={saveState === 'dirty'}
        onSave={handleApplyBulkChanges}
        onCancel={() => {
          setBulkChanges({ category: '', costCenter: '', indexationPolicy: '' });
          setSaveState('idle');
        }}
        successMessage={`Successfully updated ${selectedItems.length} items`}
      />
    </div>
  );
}
```

## Best Practices

### 1. Track Changes Granularly

```tsx
// Good: Track what actually changed
const [originalData, setOriginalData] = useState(data);
const [modifiedData, setModifiedData] = useState(data);

const hasChanges = useMemo(() => {
  return JSON.stringify(originalData) !== JSON.stringify(modifiedData);
}, [originalData, modifiedData]);
```

### 2. Prevent Navigation with Unsaved Changes

```tsx
import { useEffect } from 'react';
import { useBeforeUnload } from 'react-router-dom';

function EditableView() {
  const [hasChanges, setHasChanges] = useState(false);

  useBeforeUnload(
    useCallback((e) => {
      if (hasChanges) {
        e.preventDefault();
        return (e.returnValue = '');
      }
    }, [hasChanges])
  );

  return (
    <>
      {/* Content */}
      <SaveBar isDirty={hasChanges} onSave={handleSave} />
    </>
  );
}
```

### 3. Batch Updates for Performance

```tsx
const handleSave = async () => {
  setSaveState('saving');
  try {
    // Batch all changes into a single API call
    await ApiService.batchUpdate(selectedProjectId, {
      updates: changedCells,
      timestamp: Date.now(),
    });
    
    setSaveState('success');
  } catch (error) {
    setSaveState('error');
  }
};
```

### 4. Provide Clear Feedback

```tsx
<SaveBar
  state={saveState}
  onSave={handleSave}
  errorMessage={
    error instanceof Error 
      ? `Save failed: ${error.message}` 
      : 'An unknown error occurred'
  }
  successMessage={`${changedCells.size} changes saved successfully`}
/>
```

## Integration Checklist

When adding SaveBar to a new screen:

- [ ] Identify what constitutes "dirty" state
- [ ] Implement change tracking (setState, Map, etc.)
- [ ] Create save handler with proper error handling
- [ ] Add cancel/reset functionality
- [ ] Test all state transitions (idle → dirty → saving → success/error)
- [ ] Add navigation guards for unsaved changes
- [ ] Ensure success state auto-hides after 3 seconds
- [ ] Use logger for errors instead of console.log
- [ ] Test with slow network (throttle in DevTools)
- [ ] Verify buttons are disabled during save
