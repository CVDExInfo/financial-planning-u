/**
 * StandardTable Component
 * 
 * Enhanced table component with consistent features:
 * - Density toggle (compact vs comfortable)
 * - Sticky headers
 * - Action column placement (always rightmost)
 * - Consistent styling and spacing
 */

import { ComponentProps, ReactNode, createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TableDensity = 'compact' | 'comfortable';

interface TableContextValue {
  density: TableDensity;
  stickyHeader: boolean;
}

const TableContext = createContext<TableContextValue>({
  density: 'comfortable',
  stickyHeader: false,
});

export interface StandardTableProps extends ComponentProps<'div'> {
  /**
   * Table density - controls padding and spacing
   */
  density?: TableDensity;
  /**
   * Enable sticky header that stays visible on scroll
   */
  stickyHeader?: boolean;
  /**
   * Show density toggle control
   */
  showDensityToggle?: boolean;
  /**
   * Table children (TableHeader, TableBody, etc.)
   */
  children: ReactNode;
  /**
   * Additional classes for the container
   */
  className?: string;
}

/**
 * StandardTable - Main table component with enhanced features
 */
export function StandardTable({
  density: initialDensity = 'comfortable',
  stickyHeader = false,
  showDensityToggle = false,
  children,
  className,
  ...props
}: StandardTableProps) {
  const [density, setDensity] = useState<TableDensity>(initialDensity);

  const contextValue: TableContextValue = {
    density,
    stickyHeader,
  };

  return (
    <TableContext.Provider value={contextValue}>
      <div className={cn('space-y-2', className)} {...props}>
        {showDensityToggle && (
          <div className="flex justify-end">
            <DensityToggle density={density} onDensityChange={setDensity} />
          </div>
        )}
        <div className="relative w-full overflow-x-auto">
          <Table>
            {children}
          </Table>
        </div>
      </div>
    </TableContext.Provider>
  );
}

/**
 * Density toggle button
 */
interface DensityToggleProps {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
}

function DensityToggle({ density, onDensityChange }: DensityToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onDensityChange(density === 'compact' ? 'comfortable' : 'compact')}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
      aria-label={`Switch to ${density === 'compact' ? 'comfortable' : 'compact'} density`}
    >
      {density === 'compact' ? 'Comfortable' : 'Compact'}
    </button>
  );
}

/**
 * StandardTableHeader - Enhanced header with sticky support
 */
export function StandardTableHeader({
  className,
  children,
  ...props
}: ComponentProps<typeof TableHeader>) {
  const { stickyHeader } = useContext(TableContext);

  return (
    <TableHeader
      className={cn(
        stickyHeader && 'sticky top-0 z-10 bg-background',
        className
      )}
      {...props}
    >
      {children}
    </TableHeader>
  );
}

/**
 * StandardTableHead - Header cell with density support
 */
export function StandardTableHead({
  className,
  children,
  ...props
}: ComponentProps<typeof TableHead>) {
  const { density } = useContext(TableContext);

  const paddingClass = density === 'compact' ? 'px-2 py-1' : 'px-3 py-2';

  return (
    <TableHead
      className={cn(
        paddingClass,
        'font-semibold text-xs uppercase tracking-wide',
        className
      )}
      {...props}
    >
      {children}
    </TableHead>
  );
}

/**
 * StandardTableRow - Row with density support
 */
export function StandardTableRow({
  className,
  children,
  ...props
}: ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn('hover:bg-muted/50 transition-colors', className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}

/**
 * StandardTableCell - Cell with density support
 */
export function StandardTableCell({
  className,
  children,
  ...props
}: ComponentProps<typeof TableCell>) {
  const { density } = useContext(TableContext);

  const paddingClass = density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-3';

  return (
    <TableCell
      className={cn(paddingClass, 'text-sm', className)}
      {...props}
    >
      {children}
    </TableCell>
  );
}

/**
 * StandardTableActionCell - Special cell for action buttons
 * Always appears in the rightmost column
 */
export function StandardTableActionCell({
  className,
  children,
  ...props
}: ComponentProps<typeof TableCell>) {
  const { density } = useContext(TableContext);

  const paddingClass = density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-3';

  return (
    <TableCell
      className={cn(
        paddingClass,
        'text-sm text-right',
        // Ensure actions stay visible
        'sticky right-0 bg-background',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-end gap-2">
        {children}
      </div>
    </TableCell>
  );
}

/**
 * StandardTableBody - Body wrapper
 */
export function StandardTableBody({
  className,
  children,
  ...props
}: ComponentProps<typeof TableBody>) {
  return (
    <TableBody className={className} {...props}>
      {children}
    </TableBody>
  );
}

/**
 * StandardTableFooter - Footer for totals/summary rows
 */
export function StandardTableFooter({
  className,
  children,
  ...props
}: ComponentProps<'tfoot'>) {
  const { density } = useContext(TableContext);

  const paddingClass = density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-3';

  return (
    <tfoot
      className={cn(
        'border-t bg-muted/30 font-semibold',
        'sticky bottom-0 z-10',
        className
      )}
      {...props}
    >
      <tr>
        {children}
      </tr>
    </tfoot>
  );
}

/**
 * StandardTableEmptyState - Placeholder when table has no data
 */
export interface StandardTableEmptyStateProps {
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function StandardTableEmptyState({
  message = 'No data available',
  icon,
  action,
}: StandardTableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={100} className="h-32 text-center">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          {icon}
          <p className="text-sm">{message}</p>
          {action}
        </div>
      </TableCell>
    </TableRow>
  );
}

// Re-export for convenience
export {
  StandardTable as default,
  TableContext,
  type TableDensity,
  type TableContextValue,
};
