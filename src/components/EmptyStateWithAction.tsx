/**
 * EmptyStateWithAction Component
 * 
 * Displays a user-friendly empty state when no data is available.
 * Used throughout Finanzas to replace default/mock data fallbacks in production.
 * 
 * Usage:
 *   <EmptyStateWithAction
 *     title="No projects configured"
 *     description="There are no projects set up for this environment yet."
 *     actionLabel="Contact Administrator"
 *     onAction={() => window.location.href = 'mailto:support@example.com'}
 *   />
 */

import { AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateWithActionProps {
  /** Title of the empty state */
  title: string;
  
  /** Description explaining why there's no data */
  description: string;
  
  /** Optional action button label */
  actionLabel?: string;
  
  /** Optional action button handler */
  onAction?: () => void;
  
  /** Icon to display (defaults to Database) */
  icon?: 'alert' | 'database';
  
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline';
}

export function EmptyStateWithAction({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'database',
  variant = 'card',
}: EmptyStateWithActionProps) {
  const IconComponent = icon === 'alert' ? AlertCircle : Database;
  
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <IconComponent className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default">
          {actionLabel}
        </Button>
      )}
    </div>
  );
  
  if (variant === 'card') {
    return (
      <Card>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }
  
  return content;
}
