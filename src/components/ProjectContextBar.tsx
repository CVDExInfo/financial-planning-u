import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/ProjectContext";
import LoadingSpinner from "./LoadingSpinner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { getProjectDisplay } from "@/lib/projects/display";

interface ProjectContextBarProps {
  className?: string;
}

export function ProjectContextBar({ className }: ProjectContextBarProps) {
  const {
    selectedProjectId,
    selectProject,
    selectedPeriod,
    setSelectedPeriod,
    currentProject,
    projects,
    loading,
    projectError,
    refreshProject,
  } = useProject();
  const [open, setOpen] = useState(false);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const sortedProjects = [...safeProjects].sort((a, b) =>
    getProjectDisplay(a as any).name.localeCompare(getProjectDisplay(b as any).name, undefined, {
      sensitivity: "base",
    })
  );
  const hasProjects = sortedProjects.length > 0;
  const showEmptyState = !loading && !projectError && !hasProjects;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const periodOptions = [
    { 
      value: "CURRENT_MONTH", 
      label: "Mes actual",
      tooltip: "Muestra únicamente el mes en curso para seguimiento operativo."
    },
    { value: "3", label: "3 months" },
    { value: "6", label: "6 months" },
    { value: "12", label: "12 months" },
    { value: "24", label: "24 months" },
    { value: "36", label: "36 months" },
    { value: "48", label: "48 months" },
    { value: "60", label: "60 months" },
  ];

  if (loading) {
    return (
      <div
        className={cn(
          "border-b border-border bg-muted/20 px-6 py-3",
          className
        )}
      >
        <div className="flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
            Loading projects...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("border-b border-border bg-muted/20 px-6 py-3", className)}
    >
      <div className="max-w-7xl mx-auto space-y-3">
        {projectError && (
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-60">
              <ErrorBanner message="Unable to load projects from the Finanzas API. Please try again." />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProject}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Project Selector */}
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-foreground">
                Project:
              </label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[340px] justify-between"
                    disabled={loading || !!projectError}
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <LoadingSpinner size="sm" />
                        <span>Loading projects...</span>
                      </div>
                    ) : currentProject ? (
                      <span className="flex flex-col text-left">
                        <span className="truncate font-medium leading-tight">
                          {currentProject.name}
                        </span>
                        {currentProject.code && (
                          <span className="truncate text-xs text-muted-foreground">
                            {currentProject.code}
                          </span>
                        )}
                      </span>
                    ) : (
                      "Select project..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput
                      placeholder="Search by name, code, or client..."
                      className="border-b"
                    />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty className="py-6 text-center text-muted-foreground">
                        <div className="text-sm">No projects found</div>
                      </CommandEmpty>
                      <CommandGroup className="overflow-visible">
                        {hasProjects &&
                          sortedProjects.map((project) => {
                            const display = getProjectDisplay(project as any);
                            const isSelected = selectedProjectId === project.id;
                            const searchValue = `${display.name} ${display.code} ${display.id} ${display.client ?? ""}`;

                            return (
                              <CommandItem
                                key={project.id}
                                value={searchValue}
                                onSelect={() => {
                                  selectProject(project);
                                  setOpen(false);
                                }}
                                className={cn(
                                  "cursor-pointer px-2 py-1.5 mx-1 my-0.5 rounded-md transition-colors flex items-start gap-2 border",
                                  isSelected
                                    ? "bg-primary/5 border-primary"
                                    : "border-transparent hover:bg-muted/60",
                                )}
                              >
                                <div
                                  className={cn(
                                    "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border text-muted-foreground shrink-0",
                                    isSelected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-input",
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0 gap-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-sm leading-tight truncate">
                                      {display.name}
                                    </span>
                                    {project.status && (
                                      <Badge
                                        variant={isSelected ? "default" : "secondary"}
                                        className="text-[11px] px-2 py-0.5 capitalize"
                                      >
                                        {project.status}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                    <span className="truncate font-medium">{display.code}</span>
                                    {display.client && (
                                      <span className="truncate">• {display.client}</span>
                                    )}
                                  </div>
                                  {project.baselineId && (
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[11px] py-0 px-1.5">
                                        Baseline: {project.baselineId.substring(0, 8)}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Baseline Badge */}
            {loading ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-foreground">
                  Baseline:
                </span>
                <Skeleton className="h-6 w-24" />
              </div>
            ) : currentProject?.baselineId ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-foreground">
                  Baseline:
                </span>
                <Badge variant="default" className="gap-1">
                  {currentProject.baselineId}
                  <ExternalLink size={12} />
                </Badge>
                {(currentProject.baseline_status || currentProject.accepted_by) && (
                  <div className="flex flex-col text-xs text-muted-foreground">
                    {currentProject.baseline_status && (
                      <span className="capitalize">
                        {currentProject.baseline_status}
                      </span>
                    )}
                    {currentProject.accepted_by && (
                      <span>
                        Accepted by {currentProject.accepted_by}
                        {currentProject.baselineAcceptedAt
                          ? ` on ${formatDate(currentProject.baselineAcceptedAt)}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Period Selector */}
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-foreground">
              Period:
            </label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                {selectedPeriod === "CURRENT_MONTH" && (
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Muestra únicamente el mes en curso para seguimiento operativo.
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {showEmptyState && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            No projects are available yet. Once a baseline is created, use the
            retry button to refresh this list.
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectContextBar;
