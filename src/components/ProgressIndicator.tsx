import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "loading" | "completed" | "error";
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep?: string;
  showProgress?: boolean;
  className?: string;
}

export default function ProgressIndicator({
  steps,
  currentStep,
  showProgress = true,
  className
}: ProgressIndicatorProps) {
  const completedSteps = steps.filter(step => step.status === "completed").length;
  const progressValue = (completedSteps / steps.length) * 100;
  const currentStepIndex = currentStep ? steps.findIndex(step => step.id === currentStep) : -1;

  return (
    <div className={cn("space-y-4", className)}>
      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-muted-foreground">{completedSteps}/{steps.length} completed</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isPastStep = index < currentStepIndex;
          
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                isActive && "border-primary bg-primary/5",
                isPastStep && step.status === "completed" && "bg-muted/50",
                step.status === "error" && "border-destructive bg-destructive/5"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {step.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : step.status === "loading" ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : step.status === "error" ? (
                  <Circle className="w-5 h-5 text-destructive" />
                ) : (
                  <Circle className={cn(
                    "w-5 h-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-medium",
                  step.status === "completed" && "text-green-700",
                  step.status === "error" && "text-destructive",
                  isActive && "text-primary"
                )}>
                  {step.title}
                  {step.status === "loading" && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      Processing...
                    </span>
                  )}
                </div>
                {step.description && (
                  <div className={cn(
                    "text-sm mt-1",
                    step.status === "error" ? "text-destructive/80" : "text-muted-foreground"
                  )}>
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}