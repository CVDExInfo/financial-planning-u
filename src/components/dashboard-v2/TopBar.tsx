/**
 * TopBar Component - SKELETON/STUB
 * 
 * Top navigation and control bar for DashboardV2
 * Contains view selector, period selector, year selector, and action buttons
 * 
 * TODO: Full implementation required
 */

export interface TopBarProps {
  viewMode: 'portfolio' | 'project';
  onViewModeChange: (mode: 'portfolio' | 'project') => void;
  projectId?: string;
  onProjectIdChange: (id: string | undefined) => void;
  months: number;
  onMonthsChange: (months: number) => void;
  year: number;
  onYearChange: (year: number) => void;
  onRefresh: () => void;
  canEdit: boolean;
}

export function TopBar(props: TopBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Dashboard V2 (STUB)</div>
        <div className="text-sm text-gray-500">
          {props.viewMode} | {props.months} months | {props.year}
        </div>
      </div>
    </div>
  );
}
