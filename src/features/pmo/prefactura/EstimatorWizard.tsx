import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, ArrowRight, Download, FileText } from '@phosphor-icons/react';

export function EstimatorWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const steps = [
    { id: 1, name: 'Deal Inputs', status: 'current' },
    { id: 2, name: 'Labor', status: 'upcoming' },
    { id: 3, name: 'Non-Labor', status: 'upcoming' },
    { id: 4, name: 'FX/Indexation', status: 'upcoming' },
    { id: 5, name: 'Review & Sign', status: 'upcoming' },
  ];

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <Calculator size={32} className="text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planificador PMO</h1>
            <p className="text-muted-foreground mt-1">
              Cree estimaciones de línea base para la planificación de proyectos y pronóstico de costos
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step.id <= currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                {step.id}
              </div>
              <div className="ml-3">
                <Badge variant={step.id === currentStep ? 'default' : 'secondary'}>
                  {step.name}
                </Badge>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight size={16} className="mx-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Step {currentStep}: {steps[currentStep - 1].name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Project Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Project Name</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-border rounded-md bg-background"
                    placeholder="Enter project name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (Months)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-border rounded-md bg-background"
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Base Currency</label>
                  <select className="w-full p-3 border border-border rounded-md bg-background">
                    <option value="USD">USD</option>
                    <option value="COP">COP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">FX Rate (if applicable)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-border rounded-md bg-background"
                    placeholder="4200"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Labor Resources</h3>
              <p className="text-muted-foreground">Configure labor resources, rates, and on-costs for the project.</p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-center text-muted-foreground">Labor resource configuration will be implemented here</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Non-Labor Costs</h3>
              <p className="text-muted-foreground">Add software licenses, equipment, and other non-labor expenses.</p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-center text-muted-foreground">Non-labor cost configuration will be implemented here</p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">FX & Indexation</h3>
              <p className="text-muted-foreground">Configure foreign exchange and indexation policies.</p>
              <div className="bg-muted/50 rounded-lg p-6">
                <p className="text-center text-muted-foreground">FX and indexation settings will be implemented here</p>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Review & Sign Off</h3>
              <p className="text-muted-foreground">Review your baseline budget and generate final outputs.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">$245,600</div>
                    <p className="text-muted-foreground text-sm">Total Labor Cost</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">$38,400</div>
                    <p className="text-muted-foreground text-sm">Total Non-Labor Cost</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">$284,000</div>
                    <p className="text-muted-foreground text-sm">Total Project Cost</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex space-x-4 pt-6">
                <Button className="flex items-center space-x-2">
                  <Download size={16} />
                  <span>Export to Excel</span>
                </Button>
                <Button variant="outline" className="flex items-center space-x-2">
                  <FileText size={16} />
                  <span>Generate PDF Report</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={prevStep} 
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        <Button 
          onClick={nextStep} 
          disabled={currentStep === totalSteps}
          className="flex items-center space-x-2"
        >
          <span>{currentStep === totalSteps ? 'Complete' : 'Next'}</span>
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}