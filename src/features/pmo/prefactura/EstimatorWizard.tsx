import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, ArrowRight, Download, FileText } from '@phosphor-icons/react';

export function EstimatorWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const steps = [
    { id: 1, title: 'Deal Inputs', description: 'Project basics and currency settings' },
    { id: 2, title: 'Labor Costs', description: 'Team structure and rates' },
    { id: 3, title: 'Non-Labor Costs', description: 'Software, hardware, and services' },
    { id: 4, title: 'FX & Indexation', description: 'Currency and inflation adjustments' },
    { id: 5, title: 'Review & Sign', description: 'Final review and digital signature' },
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Calculator className="text-pmo" size={24} />
          <h1 className="text-3xl font-bold">Pre-Factura Estimator</h1>
          <Badge className="module-badge-pmo">PMO</Badge>
        </div>
        <p className="text-muted-foreground">
          Create comprehensive project cost baselines with multi-step validation and digital signature
        </p>
      </div>

      {/* Progress Indicator */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    step.id <= currentStep
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  {step.id}
                </div>
                <div className="text-center mt-2">
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className="w-full h-0.5 bg-border mt-2" />
                )}
              </div>
            ))}
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && <DealInputsStep />}
          {currentStep === 2 && <LaborCostsStep />}
          {currentStep === 3 && <NonLaborCostsStep />}
          {currentStep === 4 && <FXIndexationStep />}
          {currentStep === 5 && <ReviewSignStep />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        
        <div className="flex space-x-2">
          {currentStep === totalSteps ? (
            <>
              <Button variant="outline" className="flex items-center space-x-2">
                <Download size={16} />
                <span>Export PDF</span>
              </Button>
              <Button variant="outline" className="flex items-center space-x-2">
                <FileText size={16} />
                <span>Export Excel</span>
              </Button>
              <Button className="flex items-center space-x-2 bg-pmo hover:bg-pmo/90">
                <span>Create Baseline</span>
                <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <Button onClick={nextStep} className="flex items-center space-x-2">
              <span>Next</span>
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components (simplified for now)
function DealInputsStep() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Project Name</label>
          <input
            type="text"
            className="w-full p-2 border border-border rounded-md"
            placeholder="Enter project name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Duration (months)</label>
          <input
            type="number"
            className="w-full p-2 border border-border rounded-md"
            placeholder="12"
          />
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Define the basic project parameters and establish the foundation for cost estimation.
      </div>
    </div>
  );
}

function LaborCostsStep() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Configure team structure and labor rates for the project duration.
      </div>
      <div className="border border-border rounded-lg p-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="font-medium">Role</div>
          <div className="font-medium">Quantity</div>
          <div className="font-medium">Rate/Month</div>
          <div className="font-medium">Total</div>
        </div>
        <div className="grid grid-cols-4 gap-4 items-center py-2">
          <div>Senior Developer</div>
          <div>2</div>
          <div>$8,500</div>
          <div className="font-medium">$17,000</div>
        </div>
        <div className="grid grid-cols-4 gap-4 items-center py-2">
          <div>Junior Developer</div>
          <div>3</div>
          <div>$4,200</div>
          <div className="font-medium">$12,600</div>
        </div>
      </div>
    </div>
  );
}

function NonLaborCostsStep() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Add software licenses, hardware, and service costs.
      </div>
      <div className="space-y-3">
        {['AWS Infrastructure', 'Software Licenses', 'Hardware Setup'].map((item, index) => (
          <div key={index} className="border border-border rounded-lg p-3">
            <div className="font-medium">{item}</div>
            <div className="text-sm text-muted-foreground">Cost category details</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FXIndexationStep() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Configure currency exchange rates and indexation policies.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-4">
          <h4 className="font-medium mb-2">Exchange Rate</h4>
          <div>USD/COP: 4,200</div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <h4 className="font-medium mb-2">Indexation</h4>
          <div>CPI: 3.5% annual</div>
        </div>
      </div>
    </div>
  );
}

function ReviewSignStep() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Review the complete baseline and provide digital signature.
      </div>
      <div className="bg-accent/50 border border-accent rounded-lg p-4">
        <h4 className="font-medium mb-2">Baseline Summary</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Total Labor</div>
            <div className="font-medium">$354,000</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Non-Labor</div>
            <div className="font-medium">$87,500</div>
          </div>
        </div>
        <div className="border-t border-accent mt-3 pt-3">
          <div className="text-sm text-muted-foreground">Total Project Cost</div>
          <div className="text-xl font-bold">$441,500</div>
        </div>
      </div>
    </div>
  );
}