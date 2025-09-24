import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartLine, Download, Upload } from '@phosphor-icons/react';

export function ForecastGrid() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <ChartLine size={32} className="text-sdmt" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Forecast Grid</h1>
            <p className="text-muted-foreground mt-1">
              Manage planned, forecast, and actual costs across project timeline
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-4 mb-6">
        <Button className="flex items-center space-x-2">
          <Upload size={16} />
          <span>Import Forecast</span>
        </Button>
        <Button variant="outline" className="flex items-center space-x-2">
          <Download size={16} />
          <span>Export to Excel</span>
        </Button>
      </div>

      {/* Forecast Grid */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>60-Month Forecast View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <ChartLine size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Forecast Grid Coming Soon</h3>
            <p className="text-muted-foreground mb-4">
              Interactive 60-month grid with inline editing, variance analysis, and Excel integration
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-card rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">$1.2M</div>
                <p className="text-sm text-muted-foreground">Planned Total</p>
              </div>
              <div className="bg-card rounded-lg p-4">
                <div className="text-2xl font-bold text-accent">$1.18M</div>
                <p className="text-sm text-muted-foreground">Forecast Total</p>
              </div>
              <div className="bg-card rounded-lg p-4">
                <div className="text-2xl font-bold text-destructive">-$20K</div>
                <p className="text-sm text-muted-foreground">Variance</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}