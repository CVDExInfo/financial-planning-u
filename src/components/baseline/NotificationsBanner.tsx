import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { API_BASE } from "@/config/env";
import { buildAuthHeader } from "@/config/api";

interface Notification {
  id: string;
  type: "baseline_accepted" | "baseline_rejected";
  recipient: string;
  message: string;
  baseline_id?: string;
  actioned_by?: string;
  timestamp: string;
  read: boolean;
  comment?: string;
}

interface NotificationsBannerProps {
  projectId: string;
  /** Show all notifications or only unread (default: unread only) */
  showAll?: boolean;
}

/**
 * NotificationsBanner Component
 * 
 * Displays a banner with baseline acceptance/rejection notifications for a project.
 * Fetches notifications from GET /projects/{projectId}/notifications
 * 
 * @example
 * <NotificationsBanner projectId={projectId} />
 */
export function NotificationsBanner({ projectId, showAll = false }: NotificationsBannerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", projectId, showAll],
    queryFn: async () => {
      const url = `${API_BASE}/projects/${encodeURIComponent(projectId)}/notifications${showAll ? "" : "?unread=true"}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json() as { notifications: Notification[] };
      return data.notifications;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Don't show anything while loading or if no notifications
  if (isLoading || !data || data.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-6">
      {data.map((notification) => {
        const isAccepted = notification.type === "baseline_accepted";
        
        return (
          <Alert
            key={notification.id}
            variant={isAccepted ? "default" : "destructive"}
            className={isAccepted ? "border-green-500 bg-green-50" : ""}
          >
            <div className="flex items-start gap-3">
              {isAccepted ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4" />
                  <span className="font-semibold">
                    {isAccepted ? "Baseline Accepted" : "Baseline Rejected"}
                  </span>
                  {!notification.read && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </div>
                <AlertDescription className="text-sm">
                  <p>{notification.message}</p>
                  {notification.comment && (
                    <p className="mt-2 italic border-l-2 border-muted-foreground pl-2">
                      Reason: {notification.comment}
                    </p>
                  )}
                  {notification.actioned_by && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      by {notification.actioned_by} •{" "}
                      {new Date(notification.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
