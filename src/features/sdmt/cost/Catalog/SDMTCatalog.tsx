import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Share, Download } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/contexts/ProjectContext';
import Protected from '@/components/Protected';
import ModuleBadge from '@/components/ModuleBadge';
import { toast } from 'sonner';
import type { LineItem, BaselineBudget } from '@/types/domain.d.ts';
import ApiService from '@/lib/api';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { PDFExporter, formatReportCurrency } from '@/lib/pdf-export';

export function SDMTCatalog() {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { selectedProjectId, currentProject } = useProject();

  // Use the new permissions system
  const { canCreate, canUpdate, canDelete, isReadOnly, currentRole } = usePermissions();

  // Load data when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadLineItems();
    }
  }, [selectedProjectId]);

  const loadLineItems = async () => {
    try {
      setLoading(true);
      const items = await ApiService.getLineItems(selectedProjectId);
      setLineItems(items);
    } catch (error) {
      toast.error('Failed to load line items');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = lineItems.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(lineItems.map(item => item.category)));

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalCost = (item: LineItem) => {
    const duration = item.end_month - item.start_month + 1;
    const baseCost = item.qty * item.unit_cost;
    return item.recurring ? baseCost * duration : baseCost;
  };

  const handleShare = async () => {
    try {
      toast.loading('Generating professional report...');
      
      const totalCost = filteredItems.reduce((sum, item) => sum + calculateTotalCost(item), 0);
      const laborCost = filteredItems
        .filter(item => item.category === 'Labor')
        .reduce((sum, item) => sum + calculateTotalCost(item), 0);
      const nonLaborCost = totalCost - laborCost;
      
      const reportData = {
        title: 'Cost Catalog Summary',
        subtitle: 'Project Cost Structure Analysis',
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: 'Total Line Items',
            value: filteredItems.length.toString(),
            color: '#64748b'
          },
          {
            label: 'Total Estimated Cost',
            value: formatReportCurrency(totalCost),
            color: '#2BB673'
          },
          {
            label: 'Labor Costs',
            value: formatReportCurrency(laborCost),
            change: `${((laborCost / totalCost) * 100).toFixed(1)}% of total`,
            changeType: 'neutral' as const,
            color: '#14B8A6'
          },
          {
            label: 'Non-Labor Costs',
            value: formatReportCurrency(nonLaborCost),
            change: `${((nonLaborCost / totalCost) * 100).toFixed(1)}% of total`,
            changeType: 'neutral' as const,
            color: '#f59e0b'
          }
        ],
        summary: [
          `Cost catalog contains ${filteredItems.length} line items across ${categories.length} categories`,
          `Labor costs represent ${((laborCost / totalCost) * 100).toFixed(1)}% of total budget`,
          `${filteredItems.filter(item => item.recurring).length} recurring cost items identified`,
          `${filteredItems.filter(item => item.capex_flag).length} items flagged as capital expenditure`
        ],
        recommendations: [
          'Review recurring items for potential optimization opportunities',
          'Validate vendor quotes for significant non-labor items',
          'Consider bundling similar services for better pricing',
          'Establish clear cost center mappings for accurate tracking'
        ]
      };

      await PDFExporter.exportToPDF(reportData);
      toast.dismiss();
      toast.success('Professional catalog report generated!');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate professional report');
      console.error('Share error:', error);
    }
  };

  const handleExport = async () => {
    try {
      toast.loading('Preparing Excel export...');
      
      // Create a baseline budget structure for export
      const totalAmount = filteredItems.reduce((sum, item) => sum + calculateTotalCost(item), 0);
      
      const mockBaseline: BaselineBudget = {
        baseline_id: `catalog-${Date.now()}`,
        project_id: 'current-project',
        project_name: 'Current Project Catalog',
        created_by: currentRole,
        accepted_by: currentRole,
        accepted_ts: new Date().toISOString(),
        signature_hash: 'mock-hash',
        line_items: filteredItems,
        monthly_totals: [],
        assumptions: [
          'Cost estimates based on current market rates',
          'Currency rates as of ' + new Date().toLocaleDateString(),
          'Includes all line items in current catalog view'
        ],
        total_amount: totalAmount,
        currency: 'USD',
        created_at: new Date().toISOString(),
        status: 'draft'
      };

      const buffer = await excelExporter.exportBaselineBudget(mockBaseline);
      const filename = `cost-catalog-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      downloadExcelFile(buffer, filename);
      
      toast.dismiss();
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export catalog');
      console.error('Export error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cost Catalog</h1>
          <p className="text-muted-foreground">
            Manage project line items and cost components
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModuleBadge />
          {isReadOnly() && <Badge variant="outline" className="text-xs">Read Only</Badge>}
        </div>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search by description or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[300px]"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleShare}
            >
              <Share size={16} />
              Share
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleExport}
            >
              <Download size={16} />
              Export
            </Button>
            <Protected action="create">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus size={16} />
                    Add Line Item
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Line Item</DialogTitle>
                  <DialogDescription>
                    Create a new cost line item for the project catalog
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label>Category</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Labor">Labor</SelectItem>
                          <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                          <SelectItem value="Software">Software</SelectItem>
                          <SelectItem value="Professional Services">Professional Services</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label>Subtype</label>
                      <Input placeholder="e.g., Development" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label>Description</label>
                    <Input placeholder="Detailed description of the line item" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label>Quantity</label>
                      <Input type="number" placeholder="1" />
                    </div>
                    <div className="space-y-2">
                      <label>Unit Cost</label>
                      <Input type="number" placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <label>Currency</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="COP">COP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    toast.success('Line item added successfully');
                    setIsAddDialogOpen(false);
                  }}>
                    Add Line Item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </Protected>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{filteredItems.length}</div>
            <p className="text-sm text-muted-foreground">Total Line Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {formatCurrency(filteredItems.reduce((sum, item) => sum + calculateTotalCost(item), 0), 'USD')}
            </div>
            <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-sm text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {filteredItems.filter(item => item.recurring).length}
            </div>
            <p className="text-sm text-muted-foreground">Recurring Items</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading line items...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No line items found</p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus size={16} />
                Add First Line Item
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.category}</div>
                          {item.subtype && (
                            <div className="text-sm text-muted-foreground">{item.subtype}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="truncate">{item.description}</div>
                        {item.vendor && (
                          <div className="text-sm text-muted-foreground">Vendor: {item.vendor}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={item.one_time ? "default" : "secondary"}>
                            {item.one_time ? "One-time" : "Recurring"}
                          </Badge>
                          {item.capex_flag && (
                            <Badge variant="outline">CapEx</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.qty}</TableCell>
                      <TableCell>
                        {formatCurrency(item.unit_cost, item.currency)}
                      </TableCell>
                      <TableCell>
                        M{item.start_month}-{item.end_month}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(calculateTotalCost(item), item.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Protected action="update">
                            <Button variant="ghost" size="sm">
                              <Edit size={16} />
                            </Button>
                          </Protected>
                          <Protected action="delete">
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 size={16} />
                            </Button>
                          </Protected>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SDMTCatalog;