import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, File, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import ApiService from '@/lib/api';
import type { InvoiceDoc } from '@/types/domain';

export function Reconciliation() {
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'Pending' | 'Matched' | 'Disputed'>('all');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', 'PRJ-IKUSI-PLATFORM'],
    queryFn: () => ApiService.getInvoices('PRJ-IKUSI-PLATFORM'),
  });

  const filteredInvoices = selectedStatus === 'all' 
    ? invoices 
    : invoices.filter(inv => inv.status === selectedStatus);

  const getStatusIcon = (status: InvoiceDoc['status']) => {
    switch (status) {
      case 'Matched': return <CheckCircle size={16} className="text-green-600" />;
      case 'Disputed': return <XCircle size={16} className="text-red-600" />;
      case 'Pending': return <Clock size={16} className="text-yellow-600" />;
    }
  };

  const getStatusColor = (status: InvoiceDoc['status']) => {
    switch (status) {
      case 'Matched': return 'text-green-600 bg-green-50 border-green-200';
      case 'Disputed': return 'text-red-600 bg-red-50 border-red-200';
      case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded"></div>
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
            <span>Reconciliation</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            Upload invoices, match against forecasts, and track reconciliation status
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Upload Invoice</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download size={16} />
            <span>Variance Report</span>
          </Button>
        </div>
      </div>

      {/* Status Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Filter by Status:</span>
              <div className="flex space-x-1">
                {(['all', 'Pending', 'Matched', 'Disputed'] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={selectedStatus === status ? 'default' : 'outline'}
                    onClick={() => setSelectedStatus(status)}
                    className="capitalize"
                  >
                    {status === 'all' ? 'All' : status}
                  </Button>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredInvoices.length} invoices
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <File size={20} className="text-muted-foreground" />
                  <div>
                    <div className="font-medium">{invoice.id}</div>
                    <div className="text-sm text-muted-foreground">
                      Line Item: {invoice.line_item_id} • Month {invoice.month}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Badge className={`${getStatusColor(invoice.status)} border`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(invoice.status)}
                      <span>{invoice.status}</span>
                    </div>
                  </Badge>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                    {invoice.status === 'Pending' && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-600">
                          Match
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600">
                          Dispute
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredInvoices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No invoices found for the selected status
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold">{invoices.length}</div>
            <div className="text-sm text-muted-foreground">Total Invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {invoices.filter(inv => inv.status === 'Matched').length}
            </div>
            <div className="text-sm text-muted-foreground">Matched</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {invoices.filter(inv => inv.status === 'Pending').length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-red-600">
              {invoices.filter(inv => inv.status === 'Disputed').length}
            </div>
            <div className="text-sm text-muted-foreground">Disputed</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Comments */}
      {invoices.some(inv => inv.comments && inv.comments.length > 0) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices
                .filter(inv => inv.comments && inv.comments.length > 0)
                .slice(0, 3)
                .map((invoice) => (
                  <div key={invoice.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{invoice.id}</div>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.comments?.[invoice.comments.length - 1]}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}