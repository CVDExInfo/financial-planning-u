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
    setSelectedProjectId,
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
                  className="w-[320px] justify-between"
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
              <PopoverContent className="w-[500px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search projects... (type to filter)" />
                  <CommandList className="max-h-[500px]">
                    <CommandEmpty>No projects found.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={`${project.name} ${project.id} ${
                            project.description || ""
                          }`}
                          onSelect={() => {
                            console.log(
                              "📂 Project selected:",
                              project.name,
                              project.id
                            );
                            setSelectedProjectId(project.id);
                            setOpen(false);
                          }}
                          className="cursor-pointer py-3 px-4 hover:bg-accent aria-selected:bg-accent"
                        >
                          <Check
                            className={cn(
                              "mr-3 h-4 w-4 shrink-0",
                              selectedProjectId === project.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col flex-1 min-w-0 gap-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="font-semibold text-base truncate">
                                {project.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[11px] px-2 py-0.5 shrink-0"
                              >
                                {project.id}
                              </Badge>
                            </div>
                            {project.description && (
                              <span className="text-sm text-muted-foreground line-clamp-2">
                                {project.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
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
          ) : currentProject?.baseline_id ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">
                Baseline:
              </span>
              <Badge variant="default" className="gap-1">
                {currentProject.baseline_id}
                <ExternalLink size={12} />
              </Badge>
              {currentProject.baseline_accepted_at && (
                <span className="text-xs text-muted-foreground">
                  Accepted {formatDate(currentProject.baseline_accepted_at)}
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
