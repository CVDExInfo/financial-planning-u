import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Mail, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE } from "@/config/env";
import { buildAuthHeader } from "@/config/api";

interface BaselineQueueItem {
  baseline_id: string;
  project_id: string;
  project_name: string;
  client_name?: string;
  sdm_manager_email?: string;
  status: string;
  created_at: string;
  total_amount?: number;
}

interface BaselineVisibilityQueueProps {
  /** Title for the card */
  title?: string;
  /** Status filter for baselines (default: PendingSDMT) */
  statusFilter?: string;
  /** Max items to show (default: 20) */
  maxItems?: number;
  /** Link prefix for project details (default: /pmo/projects/) */
  projectLinkPrefix?: string;
}

/**
 * BaselineVisibilityQueue Component
 * 
 * Displays a queue of pending baselines for PMO and SDMT users.
 * Calls GET /baseline?status={status} to list baselines.
 * 
 * @example
 * // On PMO dashboard
 * <BaselineVisibilityQueue title="Pending Baselines" projectLinkPrefix="/pmo/projects/" />
 * 
 * // On SDMT dashboard
 * <BaselineVisibilityQueue title="Baselines Awaiting Review" projectLinkPrefix="/sdmt/projects/" />
 */
export function BaselineVisibilityQueue({
  title = "Pending Baselines",
  statusFilter = "PendingSDMT",
  maxItems = 20,
  projectLinkPrefix = "/pmo/projects/",
}: BaselineVisibilityQueueProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["baselines", statusFilter],
    queryFn: async () => {
      const url = `${API_BASE}/baseline?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch baselines: ${response.statusText}`);
      }

      const data = await response.json() as { items: BaselineQueueItem[] };
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const baselines = (data?.items || []).slice(0, maxItems);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock size={18} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading baselines...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            Failed to load baselines. Please try again.
          </div>
        )}

        {!isLoading && !error && baselines.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">No pending baselines</p>
            <p className="text-sm">All baselines have been reviewed</p>
          </div>
        )}

        {!isLoading && !error && baselines.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">Project</th>
                    <th className="text-left py-2 px-2 font-medium">SDM</th>
                    <th className="text-left py-2 px-2 font-medium">Amount</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-right py-2 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.map((baseline) => (
                    <tr
                      key={baseline.baseline_id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-3 px-2">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{baseline.project_name}</span>
                          {baseline.client_name && (
                            <span className="text-xs text-muted-foreground">
                              {baseline.client_name}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs w-fit">
                            {baseline.baseline_id}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {baseline.sdm_manager_email ? (
                          <a
                            href={`mailto:${baseline.sdm_manager_email}`}
                            className="flex items-center gap-1 text-primary hover:underline text-xs"
                          >
                            <Mail size={12} />
                            {baseline.sdm_manager_email}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-xs">
                        {formatCurrency(baseline.total_amount)}
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">
                        {formatDate(baseline.created_at)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                        >
                          <Link to={`${projectLinkPrefix}${baseline.project_id}`}>
                            View
                            <ExternalLink size={12} />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.items.length > maxItems && (
              <div className="text-center pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {maxItems} of {data.items.length} baselines
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
