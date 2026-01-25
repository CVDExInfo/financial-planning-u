/**
 * Design System Components - Index
 * 
 * Central export point for all Tier 3 design system components
 */

// Layout components
export {
  DashboardLayout,
  DashboardSection,
  DashboardRow,
  DashboardFullWidth,
  DashboardHalf,
  DashboardThird,
  DashboardQuarter,
} from './DashboardLayout';

// Table components
export {
  default as StandardTable,
  StandardTableHeader,
  StandardTableHead,
  StandardTableRow,
  StandardTableCell,
  StandardTableActionCell,
  StandardTableBody,
  StandardTableFooter,
  StandardTableEmptyState,
  TableContext,
  type TableDensity,
  type TableContextValue,
} from './StandardTable';

// Chip components
export {
  Chip,
  StatusChip,
  CategoryChip,
  TagChip,
  VarianceChip,
  chipVariants,
  type ChipProps,
  type StatusChipProps,
  type VarianceChipProps,
} from './Chip';

// Theme tokens
export * from '@/lib/design-system/theme';
