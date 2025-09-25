import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import LoadingState from '@/components/LoadingState';
import DataContainer from '@/components/DataContainer';
import ProgressIndicator, { ProgressStep } from '@/components/ProgressIndicator';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { toastManager } from '@/lib/toast';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';

export default function LoadingDemoPage() {
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(false);
  const [demoEmpty, setDemoEmpty] = useState(false);
  
  const { execute, isLoading, error, data } = useAsyncOperation();

  const [steps] = useState<ProgressStep[]>([
    { id: 'step1', title: 'Preparing Data', status: 'completed', description: 'Collecting project information' },
    { id: 'step2', title: 'Processing', status: 'loading', description: 'Calculating forecasts' },
    { id: 'step3', title: 'Validation', status: 'pending', description: 'Checking data integrity' },
    { id: 'step4', title: 'Finalization', status: 'pending', description: 'Generating reports' },
  ]);

  const simulateAsyncOperation = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (Math.random() > 0.7) {
      throw new Error('Random simulation error');
    }
    return { message: 'Operation completed successfully!' };
  };

  const handleToastDemo = () => {
    toastManager.success('Success message', {
      description: 'This is a successful operation',
    });
  };

  const handlePromiseDemo = () => {
    toastManager.promise(
      simulateAsyncOperation(),
      {
        loading: 'Processing request...',
        success: 'Operation completed successfully!',
        error: 'Operation failed. Please try again.',
      }
    );
  };

  const mockData = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Loading States Demo</h1>
        <p className="text-muted-foreground">
          Visual indicators and feedback components for better user experience
        </p>
      </div>

      {/* Loading Spinners */}
      <Card>
        <CardHeader>
          <CardTitle>Loading Spinners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-8">
            <div className="text-center">
              <LoadingSpinner size="sm" />
              <p className="text-sm mt-2">Small</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="md" />
              <p className="text-sm mt-2">Medium</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="text-sm mt-2">Large</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading States */}
      <Card>
        <CardHeader>
          <CardTitle>Loading State Patterns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Table Loading</h4>
              <LoadingState type="table" rows={4} />
            </div>
            <div>
              <h4 className="font-semibold mb-3">Chart Loading</h4>
              <LoadingState type="chart" />
            </div>
            <div>
              <h4 className="font-semibold mb-3">Grid Loading</h4>
              <LoadingState type="grid" rows={3} />
            </div>
            <div>
              <h4 className="font-semibold mb-3">Form Loading</h4>
              <LoadingState type="form" rows={4} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Indicator</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressIndicator 
            steps={steps} 
            currentStep="step2"
            showProgress={true}
          />
        </CardContent>
      </Card>

      {/* Data Container States */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading State</CardTitle>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setDemoLoading(!demoLoading)}
              >
                Toggle Loading
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataContainer
              data={demoLoading ? undefined : mockData}
              isLoading={demoLoading}
              loadingType="card"
              loadingRows={3}
            >
              {(data) => (
                <div className="space-y-2">
                  {Array.isArray(data) && data.map((item: any) => (
                    <div key={item.id} className="p-3 border rounded">
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </DataContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error State</CardTitle>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setDemoError(!demoError)}
              >
                Toggle Error
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataContainer
              data={demoError ? undefined : mockData}
              error={demoError ? new Error('Demonstration error') : null}
              onRetry={() => setDemoError(false)}
            >
              {(data) => (
                <div className="space-y-2">
                  {Array.isArray(data) && data.map((item: any) => (
                    <div key={item.id} className="p-3 border rounded">
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </DataContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empty State</CardTitle>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setDemoEmpty(!demoEmpty)}
              >
                Toggle Empty
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataContainer
              data={demoEmpty ? [] : mockData}
              emptyTitle="No items found"
              emptyMessage="Add some items to get started"
              emptyAction={{
                label: 'Add Item',
                onClick: () => setDemoEmpty(false)
              }}
            >
              {(data) => (
                <div className="space-y-2">
                  {Array.isArray(data) && data.map((item: any) => (
                    <div key={item.id} className="p-3 border rounded">
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </DataContainer>
          </CardContent>
        </Card>
      </div>

      {/* Toast and Async Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Toast Notifications & Async Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleToastDemo}>
              Show Success Toast
            </Button>
            <Button 
              variant="outline" 
              onClick={() => toastManager.error('Error message', { 
                description: 'Something went wrong' 
              })}
            >
              Show Error Toast
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => toastManager.warning('Warning message')}
            >
              Show Warning Toast
            </Button>
            <Button 
              variant="outline" 
              onClick={handlePromiseDemo}
            >
              Promise-based Operation
            </Button>
            <Button
              disabled={isLoading}
              onClick={() => execute(simulateAsyncOperation)}
              className="gap-2"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : null}
              {isLoading ? 'Processing...' : 'Async Operation'}
            </Button>
          </div>
          
          {data && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">{data.message}</p>
            </div>
          )}
          
          {error && (
            <div className="mt-4">
              <ErrorState 
                message={error.message}
                onRetry={() => execute(simulateAsyncOperation)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Button Loading States */}
      <Card>
        <CardHeader>
          <CardTitle>Button Loading States</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button disabled className="gap-2">
              <LoadingSpinner size="sm" />
              Processing...
            </Button>
            <Button variant="outline" disabled className="gap-2">
              <LoadingSpinner size="sm" />
              Saving...
            </Button>
            <Button variant="secondary" disabled className="gap-2">
              <LoadingSpinner size="sm" />
              Loading...
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}