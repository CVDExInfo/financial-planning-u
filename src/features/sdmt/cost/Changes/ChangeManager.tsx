import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, CheckCircle, XCircle, Clock, CurrencyDollar } from '@phosphor-icons/react';
import ApiService from '@/lib/api';

export function ChangeManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChangeTitle, setNewChangeTitle] = useState('');
  const [newChangeDescription, setNewChangeDescription] = useState('');
  const [newChangeAmount, setNewChangeAmount] = useState('');

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['changes', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getChanges('PRJ-IKUSI-PLATFORM'),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={16} className="text-green-600" />;
      case 'rejected': return <XCircle size={16} className="text-red-600" />;
      case 'pending': return <Clock size={16} className="text-yellow-600" />;
      default: return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <span>Change Management</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            Submit budget change requests and track approval workflows
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center space-x-2 bg-sdmt hover:bg-sdmt/90"
        >
          <Plus size={16} />
          <span>New Change Request</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">{changes.length}</div>
            <div className="text-sm text-muted-foreground">Total Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {changes.filter(c => c.status === 'pending').length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {changes.filter(c => c.status === 'approved').length}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">
              {formatCurrency(
                changes
                  .filter(c => c.status === 'approved')
                  .reduce((sum, c) => sum + c.impact_amount, 0)
              )}
            </div>
            <div className="text-sm text-muted-foreground">Approved Impact</div>
          </CardContent>
        </Card>
      </div>

      {/* Change Requests List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Change Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {changes.map((change) => (
              <div
                key={change.id}
                className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="font-medium text-lg">{change.title}</div>
                      <Badge className={`${getStatusColor(change.status)} border`}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(change.status)}
                          <span className="capitalize">{change.status}</span>
                        </div>
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {change.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(change.created_at).toLocaleDateString()} • {change.id}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold flex items-center space-x-1 ${
                      change.impact_amount >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      <CurrencyDollar size={16} />
                      <span>
                        {change.impact_amount >= 0 ? '+' : ''}
                        {formatCurrency(Math.abs(change.impact_amount))}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">Budget Impact</div>
                  </div>
                </div>

                {/* Approval History */}
                {change.approvals.length > 0 && (
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="text-sm font-medium mb-2">Approval History</div>
                    <div className="space-y-2">
                      {change.approvals.map((approval) => (
                        <div key={approval.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(approval.decision === 'approve' ? 'approved' : 'rejected')}
                            <span className="font-medium">{approval.approver_role}</span>
                            <span className="text-muted-foreground">
                              {approval.decision === 'approve' ? 'approved' : 'rejected'}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {new Date(approval.ts).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {change.status === 'pending' && (
                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                      Reject
                    </Button>
                    <Button size="sm" variant="outline">
                      Comment
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {changes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No change requests found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Change Request Dialog */}
      {showCreateDialog && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New Change Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                value={newChangeTitle}
                onChange={(e) => setNewChangeTitle(e.target.value)}
                placeholder="Brief description of the change"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                value={newChangeDescription}
                onChange={(e) => setNewChangeDescription(e.target.value)}
                placeholder="Detailed description of the change request"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Budget Impact (USD)</label>
              <Input
                type="number"
                value={newChangeAmount}
                onChange={(e) => setNewChangeAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={() => {
                  // Handle create logic here
                  setShowCreateDialog(false);
                  setNewChangeTitle('');
                  setNewChangeDescription('');
                  setNewChangeAmount('');
                }}
                className="bg-sdmt hover:bg-sdmt/90"
              >
                Submit Request
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-lg mb-2">📝 Immutable Audit Log</div>
            <div className="text-sm">
              Complete history of all change requests, approvals, and modifications
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}