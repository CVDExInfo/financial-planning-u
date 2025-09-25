import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Copy, BarChart3 } from 'lucide-react';
import ModuleBadge from '@/components/ModuleBadge';

export function SDMTScenarios() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Scenario Planning</h1>
            <Badge 
              variant="outline" 
              className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 font-medium"
            >
              🎁 Premium Add-on
            </Badge>
          </div>
          <p className="text-muted-foreground">Model different cost scenarios and compare outcomes</p>
        </div>
        <ModuleBadge />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Saved Scenarios</h2>
        <Button className="gap-2">
          <Plus size={16} />
          Create New Scenario
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              Baseline Scenario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Original approved baseline</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-medium">$485,000</span>
              </div>
              <div className="flex justify-between">
                <span>Impact:</span>
                <span className="text-muted-foreground">Baseline</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-2">
                <Copy size={14} />
                Clone
              </Button>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 size={20} />
              Optimistic Scenario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">10% efficiency improvements</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-medium text-green-600">$436,500</span>
              </div>
              <div className="flex justify-between">
                <span>Impact:</span>
                <span className="text-green-600">-$48,500</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-2">
                <Copy size={14} />
                Clone
              </Button>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Plus size={32} className="text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Create New Scenario</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Model different cost assumptions and compare outcomes
            </p>
            <Button className="gap-2">
              <Plus size={16} />
              New Scenario
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scenario Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Scenario modeling features coming soon</p>
            <p className="text-sm text-muted-foreground">Create what-if scenarios, adjust parameters, and compare financial impacts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SDMTScenarios;