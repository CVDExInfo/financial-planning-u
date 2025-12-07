import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ProgressIndicator from '@/components/ProgressIndicator';
import LoadingSpinner from '@/components/LoadingSpinner';

// Import step components (we'll create these)
import DealInputsStep from './steps/DealInputsStep';
import LaborStep from './steps/LaborStep';
import NonLaborStep from './steps/NonLaborStep';
import FXIndexationStep from './steps/FXIndexationStep';
import ReviewSignStep from './steps/ReviewSignStep';

// Import types
import type { DealInputs, LaborEstimate, NonLaborEstimate } from '@/types/domain';

interface EstimatorStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

const STEPS: EstimatorStep[] = [
  {
    id: 'deal-inputs',
    title: 'Datos del Proyecto',
    description: 'Información básica y cronograma',
    component: DealInputsStep
  },
  {
    id: 'labor',
    title: 'Costos de Mano de Obra',
    description: 'Composición del equipo y tarifas',
    component: LaborStep
  },
  {
    id: 'non-labor',
    title: 'Costos No Laborales',
    description: 'Infraestructura, licencias, servicios',
    component: NonLaborStep
  },
  {
    id: 'fx-indexation',
    title: 'FX e Indexación',
    description: 'Ajustes de moneda e inflación',
    component: FXIndexationStep
  },
  {
    id: 'review-sign',
    title: 'Revisión y Firma',
    description: 'Revisión final y firma digital',
    component: ReviewSignStep
  }
];

export function PMOEstimatorWizard() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Persistent wizard data
  const [dealInputs, setDealInputs] = useLocalStorage<DealInputs | null>('estimator-deal-inputs', null);
  const [laborEstimates, setLaborEstimates] = useLocalStorage<LaborEstimate[]>('estimator-labor', []);
  const [nonLaborEstimates, setNonLaborEstimates] = useLocalStorage<NonLaborEstimate[]>('estimator-non-labor', []);
  const [fxIndexationData, setFxIndexationData] = useLocalStorage<any>('estimator-fx-indexation', null);

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const progressPercentage = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStepIndex(stepIndex);
  };

  const getCurrentStepData = () => {
    switch (currentStep.id) {
      case 'deal-inputs':
        return { data: dealInputs, setData: setDealInputs };
      case 'labor':
        return { data: laborEstimates, setData: setLaborEstimates };
      case 'non-labor':
        return { data: nonLaborEstimates, setData: setNonLaborEstimates };
      case 'fx-indexation':
        return { data: fxIndexationData, setData: setFxIndexationData };
      case 'review-sign':
        return {
          data: { dealInputs, laborEstimates, nonLaborEstimates, fxIndexationData },
          setData: () => {}
        };
      default:
        return { data: null, setData: () => {} };
    }
  };

  const StepComponent = currentStep.component;
  const stepData = getCurrentStepData();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Estimador de Pre-Factura PMO</h1>
            <p className="text-muted-foreground mt-2">
              Crea un presupuesto base completo para transferir proyectos a SDMT
            </p>
          </div>
          <Badge className="module-badge-pmo">
            Módulo PMO
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Paso {currentStepIndex + 1} de {STEPS.length}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {Math.round(progressPercentage)}% Completado
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto">
        {STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          
          return (
            <div key={step.id} className="flex items-center min-w-0">
              <button
                onClick={() => handleStepClick(index)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors min-w-0
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : isCompleted
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                ) : (
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-primary-foreground' : 'bg-muted-foreground'
                  }`} />
                )}
                <div className="text-left min-w-0">
                  <div className="font-medium truncate">{step.title}</div>
                  <div className="text-xs opacity-75 truncate">{step.description}</div>
                </div>
              </button>
              
              {index < STEPS.length - 1 && (
                <ArrowRight size={16} className="text-muted-foreground mx-2 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Content */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <span>{currentStep.title}</span>
            <Badge variant="outline">{currentStep.description}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StepComponent
            data={stepData.data}
            setData={stepData.setData}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
          />
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstStep}
          className="gap-2"
        >
          <ArrowLeft size={16} />
          Anterior
        </Button>

        {isLastStep ? (
          <Button
            onClick={() => navigate('/sdmt/cost/catalog')}
            className="gap-2"
          >
            Completar y Transferir a SDMT
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="gap-2"
          >
            Siguiente
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

export default PMOEstimatorWizard;