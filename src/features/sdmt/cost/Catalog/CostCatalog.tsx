import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Upload, Download, PencilSimple, TrashSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import ApiService from '@/lib/api';
import type { LineItem } from '@/types/domain';

export function CostCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: lineItems = [], isLoading } = useQuery({
    queryKey: ['line-items'],
    queryFn: () => ApiService.getLineItems('PRJ-IKUSI-PLATFORM'),
  });

  const createMutation = useMutation({
    mutationFn: ApiService.createLineItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-items'] });
      toast.success('Line item created successfully');
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast.error('Failed to create line item: ' + error.message);
    },
  });

  const filteredItems = lineItems.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
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
            <span>Cost Catalog</span>
            <Badge className="module-badge-sdmt">SDMT</Badge>
          </h1>
          <p className="text-muted-foreground">
            Manage line items, attachments, and cost categorization
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Import CSV</span>
          </Button>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="flex items-center space-x-2 bg-sdmt hover:bg-sdmt/90"
          >
            <Plus size={16} />
            <span>Add Line Item</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search line items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline">Filter by Category</Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Download size={16} />
              <span>Export</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline">{item.category}</Badge>
                    <div className="font-medium">{item.description}</div>
                    {item.capex_flag && (
                      <Badge variant="secondary" className="text-xs">CAPEX</Badge>
                    )}
                    {item.recurring && (
                      <Badge variant="secondary" className="text-xs">Recurring</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {item.vendor && `Vendor: ${item.vendor} • `}
                    Duration: M{item.start_month}-{item.end_month}
                    {item.notes && ` • ${item.notes}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatCurrency(item.qty * item.unit_cost, item.currency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.qty} × {formatCurrency(item.unit_cost, item.currency)}
                  </div>
                </div>
                <div className="flex space-x-1 ml-4">
                  <Button size="sm" variant="outline">
                    <PencilSimple size={14} />
                  </Button>
                  <Button size="sm" variant="outline">
                    <TrashSimple size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No items match your search' : 'No line items found'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-pmo">
                {lineItems.filter(item => item.category === 'Labor').length}
              </div>
              <div className="text-sm text-muted-foreground">Labor Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-sdmt">
                {lineItems.filter(item => item.category !== 'Labor').length}
              </div>
              <div className="text-sm text-muted-foreground">Non-Labor Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">
                {lineItems.filter(item => item.capex_flag).length}
              </div>
              <div className="text-sm text-muted-foreground">CAPEX Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  lineItems.reduce((sum, item) => sum + (item.qty * item.unit_cost), 0)
                )}
              </div>
              <div className="text-sm text-muted-foreground">Total Value</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}