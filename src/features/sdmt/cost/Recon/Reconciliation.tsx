import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Upload, Download, CheckCircle } from '@phosphor-icons/react';

export function Reconciliation() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <Receipt size={32} className="text-sdmt" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reconciliation</h1>
            <p className="text-muted-foreground mt-1">
              Upload and match invoices against planned costs
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4 mb-6">
        <Button className="flex items-center space-x-2">
          <Upload size={16} />
          <span>Upload Invoice</span>
        </Button>
        <Button variant="outline" className="flex items-center space-x-2">
          <Download size={16} />
          <span>Variance Report</span>
        </Button>
      </div>

      {/* Reconciliation Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle size={24} className="text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">87%</div>
                <p className="text-muted-foreground text-sm">Matched Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Receipt size={24} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold">23</div>
                <p className="text-muted-foreground text-sm">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <Receipt size={24} className="text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold">5</div>
                <p className="text-muted-foreground text-sm">Disputed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reconciliations */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Invoice Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: 1, invoice: 'INV-2024-001', amount: '$8,500', status: 'Matched', date: '2024-01-15' },
              { id: 2, invoice: 'INV-2024-002', amount: '$4,200', status: 'Pending', date: '2024-01-14' },
              { id: 3, invoice: 'INV-2024-003', amount: '$1,200', status: 'Disputed', date: '2024-01-13' },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="font-semibold">{item.invoice}</div>
                    <div className="text-sm text-muted-foreground">{item.date}</div>
                  </div>
                  <div className="text-lg font-bold">{item.amount}</div>
                </div>
                
                <Badge variant={
                  item.status === 'Matched' ? 'default' :
                  item.status === 'Pending' ? 'secondary' : 'destructive'
                }>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}