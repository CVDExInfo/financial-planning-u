import { useState } from 'react';
import { MagnifyingGlass, Calendar, ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useKV } from '@github/spark/hooks';

export function ProjectContextBar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useKV<string>('selected-project', 'PRJ-IKUSI-PLATFORM');
  const [selectedPeriod, setSelectedPeriod] = useKV<string>('selected-period', '12');

  // Mock projects data
  const projects = [
    {
      id: 'PRJ-IKUSI-PLATFORM',
      name: 'Ikusi Digital Platform',
      baseline_id: 'BL-2024-001',
      baseline_accepted_ts: '2024-01-15T10:30:00Z',
      next_billing_periods: [
        { month: 2, amount: 125000 },
        { month: 3, amount: 98000 },
        { month: 4, amount: 142000 }
      ]
    },
    {
      id: 'PRJ-MOBILE-APP',
      name: 'Mobile Application Suite',
      baseline_id: 'BL-2024-002',
      baseline_accepted_ts: '2024-01-20T14:15:00Z',
      next_billing_periods: [
        { month: 2, amount: 85000 },
        { month: 3, amount: 76000 },
        { month: 4, amount: 91000 }
      ]
    }
  ];

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

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Project Selection */}
          <div className="flex items-center space-x-4">
            <div className="relative min-w-[280px]">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="pl-10 bg-background/50">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1">
                    <Input
                      placeholder="Search projects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-xs text-muted-foreground">{project.id}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Baseline Badge */}
            {currentProject?.baseline_id && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs">Baseline:</span>
                    <span className="font-mono text-xs">{currentProject.baseline_id}</span>
                    <ArrowSquareOut size={12} className="ml-1" />
                  </div>
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Accepted: {new Date(currentProject.baseline_accepted_ts || '').toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Period Selection and Billing Info */}
          <div className="flex items-center space-x-4">
            {/* Next 3 Billing Periods */}
            {currentProject?.next_billing_periods && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Next billing:</span>
                {currentProject.next_billing_periods.slice(0, 3).map((period) => (
                  <Badge key={period.month} variant="secondary" className="text-xs">
                    M{period.month}: {formatAmount(period.amount)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Period Picker */}
            <div className="flex items-center space-x-2">
              <Calendar size={16} className="text-muted-foreground" />
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-20 bg-background/50">
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
      </div>
    </div>
  );
}