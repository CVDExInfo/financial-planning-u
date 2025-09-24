import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, Calendar, ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useKV } from '@github/spark/hooks';
import ApiService from '@/lib/api';
import type { Project } from '@/types/domain';

export function ProjectContextBar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useKV<string>('selected-project', '');
  const [selectedPeriod, setSelectedPeriod] = useKV<string>('selected-period', '12');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => ApiService.getProjects(),
  });

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentProject = projects.find(p => p.id === selectedProject);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="mx-4 mt-4 p-4 glass-card">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Project Selector */}
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <MagnifyingGlass size={16} className="text-muted-foreground" />
            <div className="relative">
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              {searchTerm && (
                <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setSelectedProject(project.id);
                        setSearchTerm('');
                      }}
                    >
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-muted-foreground">{project.id}</div>
                    </button>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div className="px-3 py-2 text-muted-foreground">No projects found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {currentProject && (
            <div className="flex items-center space-x-3">
              <div>
                <div className="font-medium">{currentProject.name}</div>
                <div className="text-sm text-muted-foreground">{currentProject.id}</div>
              </div>
              
              {/* Baseline Badge */}
              {currentProject.baseline_id && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="flex items-center space-x-1">
                    <span>Baseline: {currentProject.baseline_id}</span>
                    <ArrowSquareOut size={12} />
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Accepted {formatDate(currentProject.baseline_accepted_ts)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Billing Chips and Period Selector */}
        <div className="flex items-center space-x-4">
          {/* Next Billing Periods */}
          {currentProject?.next_billing_periods && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Next billing:</span>
              <div className="flex space-x-1">
                {currentProject.next_billing_periods.slice(0, 3).map((period) => (
                  <Badge key={period.month} variant="secondary" className="text-xs">
                    M{period.month}: {formatAmount(period.amount)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Period Selector */}
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Period:</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3M</SelectItem>
                <SelectItem value="6">6M</SelectItem>
                <SelectItem value="12">12M</SelectItem>
                <SelectItem value="60">60M</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* No Project Selected State */}
      {!currentProject && (
        <div className="mt-4 p-6 text-center border-2 border-dashed border-border rounded-lg">
          <div className="text-muted-foreground">
            <div className="font-medium mb-2">No project selected</div>
            <div className="text-sm">Search and select a project above to begin</div>
          </div>
        </div>
      )}
    </Card>
  );
}