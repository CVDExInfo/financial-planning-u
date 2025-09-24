import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Search, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKV } from '@github/spark/hooks';
import type { Project, BillingPeriod } from '@/types/domain';
import ApiService from '@/lib/api';

interface ProjectContextBarProps {
  className?: string;
}

export function ProjectContextBar({ className }: ProjectContextBarProps) {
  const [selectedProject, setSelectedProject] = useKV<string>('selected-project-id', '');
  const [selectedPeriod, setSelectedPeriod] = useKV<string>('selected-period', '12');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const currentProject = projects.find(p => p.id === selectedProject);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectData = await ApiService.getProjects();
      setProjects(projectData);
      
      // Auto-select first project if none selected
      if (!selectedProject && projectData.length > 0) {
        setSelectedProject(projectData[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getNextBillingChips = (periods: BillingPeriod[]) => {
    return periods.slice(0, 3).map((period, index) => (
      <Badge key={period.month} variant="outline" className="text-xs">
        M{period.month}: {formatCurrency(period.amount, period.currency)}
      </Badge>
    ));
  };

  const periodOptions = [
    { value: '3', label: '3 months' },
    { value: '6', label: '6 months' },
    { value: '12', label: '12 months' },
    { value: '60', label: '60 months' },
  ];

  if (loading) {
    return (
      <div className={cn("border-b border-border bg-muted/20 px-6 py-3", className)}>
        <div className="flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-b border-border bg-muted/20 px-6 py-3", className)}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-6">
          {/* Project Selector */}
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-foreground">Project:</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[280px] justify-between"
                >
                  {currentProject ? (
                    <span className="truncate">{currentProject.name}</span>
                  ) : (
                    "Select project..."
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search projects..." />
                  <CommandList>
                    <CommandEmpty>No projects found.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          onSelect={(currentValue) => {
                            setSelectedProject(currentValue === selectedProject ? "" : currentValue);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProject === project.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{project.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {project.description}
                            </span>
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
          {currentProject?.baseline_id && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">Baseline:</span>
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
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Next Billing Periods */}
          {currentProject?.next_billing_periods && currentProject.next_billing_periods.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground">Next Billing:</span>
              <div className="flex items-center space-x-1">
                {getNextBillingChips(currentProject.next_billing_periods)}
              </div>
            </div>
          )}
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