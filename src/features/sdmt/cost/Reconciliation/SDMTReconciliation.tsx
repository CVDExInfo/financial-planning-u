import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileCheck, AlertTriangle } from 'lucide-react';

export function SDMTReconciliation() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reconciliation</h1>
          <p className="text-muted-foreground">Upload and match invoices against forecasted amounts</p>
        </div>
        <Badge className="module-badge-sdmt">SDMT Module</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileCheck className="mx-auto mb-2 text-green-600" size={32} />
            <div className="text-2xl font-bold text-green-600">7</div>
            <p className="text-sm text-muted-foreground">Matched Invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Upload className="mx-auto mb-2 text-blue-600" size={32} />
            <div className="text-2xl font-bold text-blue-600">1</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 text-red-600" size={32} />
            <div className="text-2xl font-bold text-red-600">1</div>
            <p className="text-sm text-muted-foreground">Disputed Items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Upload & Matching</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Reconciliation features coming soon</p>
            <p className="text-sm text-muted-foreground">Upload invoices, match against forecasts, and track payment status</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SDMTReconciliation;