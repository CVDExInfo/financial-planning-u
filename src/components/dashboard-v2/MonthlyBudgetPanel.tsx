/**
 * MonthlyBudgetPanel Component - SKELETON/STUB
 * 
 * Position #2: Collapsible panel for monthly budget management
 * 
 * TODO: Full implementation with 12-month grid and auto-sum required
 */

export interface MonthlyBudgetPanelProps {
  year: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  canEdit: boolean;
}

export function MonthlyBudgetPanel(props: MonthlyBudgetPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={props.onToggleExpanded}>
        <div className="text-sm font-semibold">Monthly Budget ({props.year}) (STUB)</div>
        <div className="text-xs text-gray-500">{props.isExpanded ? 'Collapse' : 'Expand'}</div>
      </div>
      {props.isExpanded && (
        <div className="border-t border-gray-200 p-4">
          <div className="text-sm text-gray-600">Monthly budget grid will be rendered here</div>
        </div>
      )}
    </div>
  );
}
