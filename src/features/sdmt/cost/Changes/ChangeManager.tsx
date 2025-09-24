import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitCommit, Plus, Eye } from '@phosphor-icons/react';

export function ChangeManager() {
  const changes = [
    {
      id: 'CHG-001',
      title: 'Additional Senior Developer - Q2 Extension',
      description: 'Add 1 Senior Developer for additional 3 months to handle integration complexity',
      impact: '+$25,500',
      status: 'approved',
      requested_by: 'john.doe@ikusi.com',
      requested_date: '2024-01-20',
      approved_by: 'jane.smith@ikusi.com',
      approved_date: '2024-01-22'
    },
    {
      id: 'CHG-002', 
      title: 'Cloud Infrastructure Upgrade',
      description: 'Upgrade to enterprise tier for performance requirements',
      impact: '+$8,400',
      status: 'pending',
      requested_by: 'carlos.rivera@ikusi.com',
      requested_date: '2024-01-25'
    },
    {
      id: 'CHG-003',
      title: 'Software License Cost Reduction',
      description: 'Negotiated volume discount on development tools',
      impact: '-$3,600',
      status: 'implemented',
      requested_by: 'maria.gonzalez@ikusi.com',
      requested_date: '2024-01-18',
      approved_by: 'jane.smith@ikusi.com',
      approved_date: '2024-01-19',
      implemented_date: '2024-01-24'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GitCommit size={32} className="text-sdmt" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Change Manager</h1>
              <p className="text-muted-foreground mt-1">
                Track and approve budget change requests with full audit trail
              </p>
            </div>
          </div>
          
          <Button className="flex items-center space-x-2">
            <Plus size={16} />
            <span>New Change Request</span>
          </Button>
        </div>
      </div>

      {/* Change Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-accent">3</div>
            <p className="text-muted-foreground text-sm">Total Changes</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">1</div>
            <p className="text-muted-foreground text-sm">Approved</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-secondary">1</div>
            <p className="text-muted-foreground text-sm">Pending</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">+$30.3K</div>
            <p className="text-muted-foreground text-sm">Net Impact</p>
          </CardContent>
        </Card>
      </div>

      {/* Change Requests */}
      <div className="space-y-6">
        {changes.map((change) => (
          <Card key={change.id} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                      {change.id}
                    </span>
                    <Badge variant={
                      change.status === 'approved' ? 'default' :
                      change.status === 'pending' ? 'secondary' :
                      change.status === 'implemented' ? 'default' : 'outline'
                    }>
                      {change.status.toUpperCase()}
                    </Badge>
                    <span className={`font-semibold ${
                      change.impact.startsWith('+') ? 'text-destructive' : 'text-primary'
                    }`}>
                      {change.impact}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {change.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-4">
                    {change.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Requested by:</span>
                      <div className="font-medium">{change.requested_by}</div>
                      <div className="text-muted-foreground text-xs">{change.requested_date}</div>
                    </div>
                    
                    {change.approved_by && (
                      <div>
                        <span className="text-muted-foreground">Approved by:</span>
                        <div className="font-medium">{change.approved_by}</div>
                        <div className="text-muted-foreground text-xs">{change.approved_date}</div>
                      </div>
                    )}
                    
                    {change.implemented_date && (
                      <div>
                        <span className="text-muted-foreground">Implemented:</span>
                        <div className="font-medium">{change.implemented_date}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <Button size="sm" variant="outline" className="flex items-center space-x-2">
                    <Eye size={14} />
                    <span>Details</span>
                  </Button>
                  {change.status === 'pending' && (
                    <>
                      <Button size="sm">Approve</Button>
                      <Button size="sm" variant="outline">Reject</Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Audit Trail */}
      <Card className="glass-card mt-8">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'CHG-001 approved by Jane Smith', time: '2 days ago', type: 'approval' },
              { action: 'CHG-002 created by Carlos Rivera', time: '3 days ago', type: 'creation' },
              { action: 'CHG-003 implemented', time: '4 days ago', type: 'implementation' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'approval' ? 'bg-primary' :
                  activity.type === 'creation' ? 'bg-accent' : 'bg-secondary'
                }`}></div>
                <span className="flex-1">{activity.action}</span>
                <span className="text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}