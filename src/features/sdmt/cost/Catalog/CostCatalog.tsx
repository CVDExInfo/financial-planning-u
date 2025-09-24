import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Upload, Download, PencilSimple, TrashSimple, MagnifyingGlass } from '@phosphor-icons/react';

export function CostCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mock data for demonstration
  const mockLineItems = [
    {
      id: 'labor_1',
      category: 'Labor',
      subtype: 'Senior Developer',
      description: 'Senior Software Developer - 12 months',
      unit_cost: 8500,
      currency: 'USD',
      recurring: true
    },
    {
      id: 'labor_2', 
      category: 'Labor',
      subtype: 'Junior Developer',
      description: 'Junior Software Developer - 12 months',
      unit_cost: 4200,
      currency: 'USD',
      recurring: true
    },
    {
      id: 'software_1',
      category: 'Software',
      subtype: 'License',
      description: 'Enterprise Development Tools License',
      unit_cost: 1200,
      currency: 'USD',
      recurring: false
    }
  ];

  const filteredItems = mockLineItems.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Cost Catalog</h1>
        <p className="text-muted-foreground">
          Manage and organize line items for cost tracking and forecasting
        </p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search line items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex space-x-2">
          <Button className="flex items-center space-x-2">
            <Plus size={16} />
            <span>Add Item</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload size={16} />
            <span>Import CSV</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download size={16} />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Line Items Grid */}
      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="glass-card hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge variant="secondary">{item.category}</Badge>
                    <Badge variant="outline">{item.subtype}</Badge>
                    {item.recurring && (
                      <Badge variant="outline" className="text-primary">Recurring</Badge>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {item.description}
                  </h3>
                  
                  <div className="text-2xl font-bold text-primary">
                    ${item.unit_cost.toLocaleString()} {item.currency}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" className="hover:bg-primary/10">
                    <PencilSimple size={16} />
                  </Button>
                  <Button size="sm" variant="outline" className="hover:bg-destructive/10 text-destructive">
                    <TrashSimple size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              {searchTerm ? 'No items match your search criteria.' : 'No line items found. Start by adding your first cost item.'}
            </div>
            <Button className="mt-4" onClick={() => setSearchTerm('')}>
              {searchTerm ? 'Clear Search' : 'Add First Item'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}