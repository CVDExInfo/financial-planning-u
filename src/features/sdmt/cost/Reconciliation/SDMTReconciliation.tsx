import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Upload, FileCheck, AlertTriangle, ExternalLink, Plus, X, Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import ModuleBadge from '@/components/ModuleBadge';
import DataContainer from '@/components/DataContainer';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import type { InvoiceDoc, LineItem, ForecastCell } from '@/types/domain';
import ApiService from '@/lib/api';
import { excelExporter, downloadExcelFile } from '@/lib/excel-export';
import { PDFExporter, formatReportCurrency, formatReportPercentage, getChangeType } from '@/lib/pdf-export';

export function SDMTReconciliation() {
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    line_item_id: '',
    month: 1,
    amount: '',
    description: '',
    file: null as File | null,
    vendor: '',
    invoice_number: '',
    invoice_date: ''
  });
  
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedProjectId, currentProject, projectChangeCount } = useProject();
  
  // Use async operation hook for uploads
  const uploadOperation = useAsyncOperation({
    onSuccess: () => {
      setShowUploadForm(false);
      loadInvoices(); // Refresh data
    }
  });
  
  // Parse URL params for filtering (when coming from forecast)
  const urlParams = new URLSearchParams(location.search);
  const filterLineItem = urlParams.get('line_item');
  const filterMonth = urlParams.get('month');

  // Load data when project changes
  useEffect(() => {
    if (selectedProjectId) {
      console.log('🧾 Reconciliation: Loading data for project:', selectedProjectId, 'change count:', projectChangeCount);
      loadInvoices();
      loadLineItems();
    }
    
    // Pre-populate form if coming from forecast
    if (filterLineItem) {
      setUploadFormData(prev => ({
        ...prev,
        line_item_id: filterLineItem,
        month: filterMonth ? parseInt(filterMonth) : 1
      }));
      setShowUploadForm(true);
    }
  }, [selectedProjectId, filterLineItem, filterMonth, projectChangeCount]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getInvoices(selectedProjectId);
      setInvoices(data);
    } catch (error) {
      toast.error('Failed to load invoices');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadLineItems = async () => {
    try {
      const items = await ApiService.getLineItems(selectedProjectId);
      setLineItems(items);
    } catch (error) {
      console.error('Failed to load line items:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFormData(prev => ({ ...prev, file }));
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!uploadFormData.file || !uploadFormData.line_item_id || !uploadFormData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const invoice = await ApiService.uploadInvoice(
        'current-project',
        uploadFormData.file,
        uploadFormData.line_item_id,
        uploadFormData.month
      );
      
      setInvoices(prev => [...prev, {
        ...invoice,
        amount: parseFloat(uploadFormData.amount),
        file_name: uploadFormData.file?.name || ''
      }]);
      
      toast.success('Invoice uploaded successfully');
      setShowUploadForm(false);
      setUploadFormData({
        line_item_id: '',
        month: 1,
        amount: '',
        description: '',
        file: null,
        vendor: '',
        invoice_number: '',
        invoice_date: ''
      });
    } catch (error) {
      toast.error('Failed to upload invoice');
      console.error(error);
    }
  };

  const handleStatusUpdate = async (invoiceId: string, status: 'Pending' | 'Matched' | 'Disputed', comment?: string) => {
    try {
      const updatedInvoice = await ApiService.updateInvoiceStatus(invoiceId, status, comment);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));
      toast.success(`Invoice status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update invoice status');
      console.error(error);
    }
  };

  const navigateToForecast = (line_item_id: string, month?: number) => {
    const params = new URLSearchParams();
    if (month) params.set('month', month.toString());
    params.set('line_item', line_item_id);
    navigate(`/sdmt/cost/forecast?${params.toString()}`);
  };

  // Filter invoices based on URL params
  const filteredInvoices = invoices.filter(invoice => {
    if (filterLineItem && invoice.line_item_id !== filterLineItem) return false;
    if (filterMonth && invoice.month !== parseInt(filterMonth)) return false;
    return true;
  });

  const matchedCount = filteredInvoices.filter(inv => inv.status === 'Matched').length;
  const pendingCount = filteredInvoices.filter(inv => inv.status === 'Pending').length;
  const disputedCount = filteredInvoices.filter(inv => inv.status === 'Disputed').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getLineItemName = (lineItemId: string) => {
    const item = lineItems.find(li => li.id === lineItemId);
    return item ? `${item.description} (${item.category})` : lineItemId;
  };

  // Export functions
  const handleExportVarianceReport = async () => {
    try {
      toast.loading('Generating variance report...');
      
      // Convert invoice data to forecast format for variance analysis
      const mockForecastData: ForecastCell[] = filteredInvoices.map(invoice => {
        const lineItem = lineItems.find(li => li.id === invoice.line_item_id);
        // Mock planned amount based on line item
        const plannedAmount = lineItem ? (lineItem.qty * lineItem.unit_cost) : invoice.amount;
        
        return {
          line_item_id: invoice.line_item_id,
          month: invoice.month,
          planned: plannedAmount,
          forecast: plannedAmount,
          actual: invoice.amount,
          variance: invoice.amount - plannedAmount,
          variance_reason: invoice.status === 'Disputed' ? 'scope' : undefined,
          notes: invoice.comments?.[0],
          last_updated: invoice.uploaded_at,
          updated_by: invoice.uploaded_by
        } as ForecastCell;
      });

      const buffer = await excelExporter.exportVarianceReport(mockForecastData, lineItems);
      const filename = `invoice-variance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      downloadExcelFile(buffer, filename);
      
      toast.dismiss();
      toast.success('Variance report exported successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export variance report');
      console.error('Export error:', error);
    }
  };

  const handleShareReconciliationSummary = async () => {
    try {
      toast.loading('Generating professional reconciliation report...');
      
      const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const matchRate = filteredInvoices.length ? ((matchedCount / filteredInvoices.length) * 100) : 0;
      const averageInvoiceAmount = filteredInvoices.length ? totalAmount / filteredInvoices.length : 0;
      
      const reportData = {
        title: 'Invoice Reconciliation Report',
        subtitle: 'Financial Control & Compliance Summary',
        generated: new Date().toLocaleDateString(),
        metrics: [
          {
            label: 'Total Invoices Processed',
            value: filteredInvoices.length.toString(),
            color: '#64748b'
          },
          {
            label: 'Successfully Matched',
            value: matchedCount.toString(),
            change: `${matchRate.toFixed(1)}% match rate`,
            changeType: (matchRate >= 80 ? 'positive' : matchRate >= 60 ? 'neutral' : 'negative') as 'positive' | 'negative' | 'neutral',
            color: '#22c55e'
          },
          {
            label: 'Pending Review',
            value: pendingCount.toString(),
            change: pendingCount > 0 ? 'Requires attention' : 'All current',
            changeType: (pendingCount > 0 ? 'neutral' : 'positive') as 'positive' | 'negative' | 'neutral',
            color: '#f59e0b'
          },
          {
            label: 'Disputed Items',
            value: disputedCount.toString(),
            change: disputedCount > 0 ? 'Need resolution' : 'None',
            changeType: (disputedCount > 0 ? 'negative' : 'positive') as 'positive' | 'negative' | 'neutral',
            color: disputedCount > 0 ? '#ef4444' : '#22c55e'
          }
        ],
        summary: [
          `Processed ${filteredInvoices.length} invoices worth ${formatReportCurrency(totalAmount)}`,
          `Invoice match rate: ${matchRate.toFixed(1)}% (${matchedCount}/${filteredInvoices.length})`,
          `Average invoice amount: ${formatReportCurrency(averageInvoiceAmount)}`,
          `${disputedCount} disputes require immediate attention`
        ],
        recommendations: [
          matchRate < 80 ? 'Improve invoice matching process - current rate below target' : 'Maintain excellent matching performance',
          pendingCount > 0 ? `Process ${pendingCount} pending invoices to improve cycle time` : 'No pending items - excellent processing speed',
          disputedCount > 0 ? `Resolve ${disputedCount} disputed invoices to reduce financial risk` : 'No disputes - strong vendor relationship management',
          'Implement automated matching rules to improve efficiency'
        ]
      };

      await PDFExporter.exportToPDF(reportData);
      toast.dismiss();
      toast.success('Professional reconciliation report generated!');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate professional report');
      console.error('Share error:', error);
    }
  };
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoice Reconciliation</h1>
          <p className="text-muted-foreground">
            Upload and match invoices against forecasted amounts
            {currentProject && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {currentProject.name} | Change #{projectChangeCount}
              </span>
            )}
          </p>
          {(filterLineItem || filterMonth) && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                Filtered: {filterLineItem && getLineItemName(filterLineItem)} 
                {filterMonth && ` - Month ${filterMonth}`}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/sdmt/cost/reconciliation')}
              >
                <X size={14} className="mr-1" /> Clear Filter
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleShareReconciliationSummary}
            className="gap-2"
          >
            <Share2 size={16} />
            Share
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportVarianceReport}
            className="gap-2"
          >
            <Download size={16} />
            Export
          </Button>
          <ModuleBadge />
          <Button onClick={() => setShowUploadForm(true)} className="gap-2">
            <Plus size={16} />
            Upload Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileCheck className="mx-auto mb-2 text-green-600" size={32} />
            <div className="text-2xl font-bold text-green-600">{matchedCount}</div>
            <p className="text-sm text-muted-foreground">Matched Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Upload className="mx-auto mb-2 text-blue-600" size={32} />
            <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 text-red-600" size={32} />
            <div className="text-2xl font-bold text-red-600">{disputedCount}</div>
            <p className="text-sm text-muted-foreground">Disputed Items</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Upload Dialog */}
      <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Invoice</DialogTitle>
            <DialogDescription>
              Upload invoice documents and link them to specific cost line items and time periods.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="line_item">Line Item *</Label>
                <Select 
                  value={uploadFormData.line_item_id} 
                  onValueChange={(value) => setUploadFormData(prev => ({ ...prev, line_item_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select line item" />
                  </SelectTrigger>
                  <SelectContent>
                    {lineItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.description} ({item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="month">Month *</Label>
                <Select 
                  value={uploadFormData.month.toString()} 
                  onValueChange={(value) => setUploadFormData(prev => ({ ...prev, month: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        Month {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Invoice Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={uploadFormData.amount}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  placeholder="Vendor name"
                  value={uploadFormData.vendor}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, vendor: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  placeholder="INV-001"
                  value={uploadFormData.invoice_number}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={uploadFormData.invoice_date}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Additional notes or description"
                value={uploadFormData.description}
                onChange={(e) => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="file">Upload File *</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                  onChange={handleFileUpload}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Supported formats: PDF, JPG, PNG, Excel, CSV
                </p>
                {uploadFormData.file && (
                  <p className="text-sm text-primary mt-2">
                    Selected: {uploadFormData.file.name}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvoiceSubmit}>
              Upload Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices & Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading invoices...</div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {filterLineItem || filterMonth ? 'No invoices found matching filter' : 'No invoices uploaded yet'}
              </p>
              <p className="text-sm text-muted-foreground">
                Upload invoices to track and match against forecast amounts
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line Item</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{getLineItemName(invoice.line_item_id)}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            onClick={() => navigateToForecast(invoice.line_item_id, invoice.month)}
                            title="View in forecast"
                          >
                            <ExternalLink size={12} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>Month {invoice.month}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            invoice.status === 'Matched' ? 'default' :
                            invoice.status === 'Disputed' ? 'destructive' : 'secondary'
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={invoice.file_name}>
                        {invoice.file_name}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(invoice.uploaded_at).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">{invoice.uploaded_by}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {invoice.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(invoice.id, 'Matched')}
                              >
                                Match
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(invoice.id, 'Disputed', 'Requires review')}
                              >
                                Dispute
                              </Button>
                            </>
                          )}
                          {invoice.status === 'Disputed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(invoice.id, 'Matched')}
                            >
                              Resolve
                            </Button>
                          )}
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

export default SDMTReconciliation;