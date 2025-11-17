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
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/ProjectContext";
import LoadingSpinner from "./LoadingSpinner";

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
  } = useProject();
  const [open, setOpen] = useState(false);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const periodOptions = [
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
      <div className="flex items-center justify-between max-w-7xl mx-auto">
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
                  className="w-[320px] justify-between border-emerald-200 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950 bg-white"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner size="sm" />
                      <span>Loading projects...</span>
                    </div>
                  ) : currentProject ? (
                    <span className="truncate font-medium">
                      {currentProject.name}
                    </span>
                  ) : (
                    "Select project..."
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[550px] p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput
                    placeholder="Search projects by name, ID, or description..."
                    className="border-b"
                  />
                  <CommandList className="max-h-[450px]">
                    <CommandEmpty className="py-8 text-center text-muted-foreground">
                      <div className="text-sm">No projects found</div>
                    </CommandEmpty>
                    <CommandGroup className="overflow-visible">
                      {projects.map((project) => {
                        const isSelected = selectedProjectId === project.id;
                        return (
                          <CommandItem
                            key={project.id}
                            value={project.id}
                            onSelect={() => {
                              selectProject(project);
                              setOpen(false);
                            }}
                            className={cn(
                              "cursor-pointer px-3 py-3.5 mx-1 my-0.5 rounded-md transition-colors flex items-start gap-3",
                              isSelected
                                ? "bg-emerald-50 border border-emerald-200"
                                : "hover:bg-muted/60 border border-transparent"
                            )}
                          >
                            <div className="mt-0.5 shrink-0">
                              <Check
                                className={cn(
                                  "h-5 w-5 rounded border border-input transition-colors",
                                  isSelected
                                    ? "bg-emerald-500 text-white border-emerald-500"
                                    : "text-muted-foreground"
                                )}
                              />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm leading-tight">
                                  {project.name}
                                </span>
                                <Badge
                                  variant={isSelected ? "default" : "secondary"}
                                  className={cn(
                                    "text-xs px-2 py-0.5 shrink-0 whitespace-nowrap border",
                                    isSelected
                                      ? "bg-emerald-500/90 text-white border-emerald-500"
                                      : "bg-slate-100 text-slate-700 border-transparent"
                                  )}
                                >
                                  {project.id}
                                </Badge>
                              </div>
                              {project.description && (
                                <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {project.description}
                                </span>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                {project.baselineId && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs py-0 px-1.5 border-emerald-200 text-emerald-800"
                                  >
                                    <span className="text-[10px]">
                                      Baseline:{" "}
                                      {project.baselineId.substring(0, 8)}
                                    </span>
                                  </Badge>
                                )}
                                {project.status && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs py-0 px-1.5 border-slate-200 text-slate-600"
                                  >
                                    <span className="text-[10px] font-medium">
                                      {project.status}
                                    </span>
                                  </Badge>
                                )}
                              </div>
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
              {currentProject.baselineAcceptedAt && (
                <span className="text-xs text-muted-foreground">
                  Accepted {formatDate(currentProject.baselineAcceptedAt)}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Period Selector */}
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-foreground">Period:</label>
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
      </div>
    </div>
  );
}

export default ProjectContextBar;
