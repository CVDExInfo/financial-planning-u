import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function SDMTChanges() {
  const mockChanges = [
    {
      id: 'CHG-2024-001',
      title: 'Additional Senior Developer',
      description: 'Add one additional senior developer for Q2',
      impact: 25500,
      status: 'pending',
      requestedBy: 'project-manager@ikusi.com',
      requestedAt: '2024-02-15T11:00:00Z'
    },
    {
      id: 'CHG-2024-002',
      title: 'AWS Infrastructure Upgrade',
      description: 'Upgrade to higher-tier instances for performance',
      impact: 8000,
      status: 'approved',
      requestedBy: 'tech-lead@ikusi.com',
      requestedAt: '2024-02-10T14:30:00Z'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-amber-500" size={16} />;
      case 'approved':
        return <CheckCircle2 className="text-green-500" size={16} />;
      case 'rejected':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <AlertCircle className="text-muted-foreground" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-amber-600 bg-amber-50';
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Change Management</h1>
          <p className="text-muted-foreground">Track budget change requests and approval workflows</p>
        </div>
        <Badge className="module-badge-sdmt">SDMT Module</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="mx-auto mb-2 text-amber-500" size={32} />
            <div className="text-2xl font-bold text-amber-600">1</div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
            <div className="text-2xl font-bold text-green-600">1</div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="mx-auto mb-2 text-red-500" size={32} />
            <div className="text-2xl font-bold text-red-600">0</div>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">$33.5K</div>
            <p className="text-sm text-muted-foreground">Total Impact</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Change Requests</h2>
        <Button className="gap-2">
          <Plus size={16} />
          New Change Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockChanges.map((change) => (
                <TableRow key={change.id}>
                  <TableCell className="font-mono">{change.id}</TableCell>
                  <TableCell className="font-medium">{change.title}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate">{change.description}</div>
                  </TableCell>
                  <TableCell>
                    <span className={change.impact > 0 ? 'text-red-600' : 'text-green-600'}>
                      {change.impact > 0 ? '+' : ''}${change.impact.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(change.status)}`}>
                      {getStatusIcon(change.status)}
                      {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {change.requestedBy.split('@')[0]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(change.requestedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Change approval workflow coming soon</p>
            <p className="text-sm text-muted-foreground">Multi-stage approval process with notifications and audit trail</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SDMTChanges;