import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertCircle, DollarSign } from 'lucide-react';

interface FXData {
  usd_cop_rate: number;
  rate_source: string;
  hedging_strategy: 'none' | 'forward_80' | 'forward_100' | 'options';
}

interface IndexationData {
  cpi_annual_rate: number;
  min_wage_annual_rate: number;
  adjustment_frequency: 'monthly' | 'quarterly' | 'annually';
  labor_indexation: 'CPI' | 'min_wage' | 'none';
  non_labor_indexation: 'CPI' | 'none';
}

interface FXIndexationStepProps {
  data: { fx: FXData; indexation: IndexationData } | null;
  setData: (data: { fx: FXData; indexation: IndexationData }) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function FXIndexationStep({ data, setData, onNext }: FXIndexationStepProps) {
  const [fxData, setFxData] = useState<FXData>(
    data?.fx || {
      usd_cop_rate: 4000,
      rate_source: 'Banco de la República',
      hedging_strategy: 'forward_80'
    }
  );

  const [indexationData, setIndexationData] = useState<IndexationData>(
    data?.indexation || {
      cpi_annual_rate: 3.0,
      min_wage_annual_rate: 12.0,
      adjustment_frequency: 'quarterly',
      labor_indexation: 'CPI',
      non_labor_indexation: 'CPI'
    }
  );

  const updateFxData = (field: keyof FXData, value: any) => {
    setFxData(prev => ({ ...prev, [field]: value }));
  };

  const updateIndexationData = (field: keyof IndexationData, value: any) => {
    setIndexationData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setData({ fx: fxData, indexation: indexationData });
    onNext();
  };

  const getHedgingDescription = (strategy: string) => {
    switch (strategy) {
      case 'none': return 'No hedging - full FX exposure';
      case 'forward_80': return '80% hedged with forward contracts';
      case 'forward_100': return '100% hedged with forward contracts';
      case 'options': return 'Options strategy for downside protection';
      default: return '';
    }
  };

  const calculateIndexationImpact = () => {
    const laborRate = indexationData.labor_indexation === 'CPI' 
      ? indexationData.cpi_annual_rate 
      : indexationData.labor_indexation === 'min_wage'
      ? indexationData.min_wage_annual_rate
      : 0;

    const nonLaborRate = indexationData.non_labor_indexation === 'CPI'
      ? indexationData.cpi_annual_rate
      : 0;

    return { laborRate, nonLaborRate };
  };

  const indexationImpact = calculateIndexationImpact();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">FX & Indexation Parameters</h2>
        <p className="text-muted-foreground">
          Define currency exchange rates and inflation adjustments for accurate cost projections
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FX Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign size={20} />
              Foreign Exchange (FX)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>USD/COP Exchange Rate</Label>
              <Input
                type="number"
                value={fxData.usd_cop_rate}
                onChange={(e) => updateFxData('usd_cop_rate', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 4000"
              />
              <p className="text-xs text-muted-foreground">
                Current spot rate for project calculations
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rate Source</Label>
              <Select
                value={fxData.rate_source}
                onValueChange={(value) => updateFxData('rate_source', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Banco de la República">Banco de la República</SelectItem>
                  <SelectItem value="Bloomberg">Bloomberg</SelectItem>
                  <SelectItem value="Reuters">Reuters</SelectItem>
                  <SelectItem value="Internal Treasury">Internal Treasury</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hedging Strategy</Label>
              <Select
                value={fxData.hedging_strategy}
                onValueChange={(value) => updateFxData('hedging_strategy', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Hedging</SelectItem>
                  <SelectItem value="forward_80">80% Forward Hedge</SelectItem>
                  <SelectItem value="forward_100">100% Forward Hedge</SelectItem>
                  <SelectItem value="options">Options Strategy</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getHedgingDescription(fxData.hedging_strategy)}
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>What this means:</strong> If any project costs are paid in US dollars, this exchange rate will automatically convert them to Colombian pesos for your reports.
                <br />
                <strong>Action needed:</strong> Verify the exchange rate is current. Update it if you have a more recent rate from your finance team.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Indexation Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} />
              Indexation Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPI Annual Rate (%)</Label>
                <Input
                  type="number"
                  value={indexationData.cpi_annual_rate}
                  onChange={(e) => updateIndexationData('cpi_annual_rate', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 3.0"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Wage Annual Rate (%)</Label>
                <Input
                  type="number"
                  value={indexationData.min_wage_annual_rate}
                  onChange={(e) => updateIndexationData('min_wage_annual_rate', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 12.0"
                  step="0.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adjustment Frequency</Label>
              <Select
                value={indexationData.adjustment_frequency}
                onValueChange={(value) => updateIndexationData('adjustment_frequency', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Labor Cost Indexation</Label>
                <Select
                  value={indexationData.labor_indexation}
                  onValueChange={(value) => updateIndexationData('labor_indexation', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Indexation</SelectItem>
                    <SelectItem value="CPI">Consumer Price Index (CPI)</SelectItem>
                    <SelectItem value="min_wage">Minimum Wage Increases</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Non-Labor Cost Indexation</Label>
                <Select
                  value={indexationData.non_labor_indexation}
                  onValueChange={(value) => updateIndexationData('non_labor_indexation', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Indexation</SelectItem>
                    <SelectItem value="CPI">Consumer Price Index (CPI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>
                <strong>What this means:</strong> Costs will automatically increase over time to account for inflation, helping you budget accurately for longer projects.
                <br />
                <strong>When it happens:</strong> Adjustments start in month 4 and apply {indexationData.adjustment_frequency}. The first 3 months use fixed costs.
                <br />
                <strong>Action needed:</strong> Confirm the inflation rates match your company's financial planning assumptions.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Impact Summary */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>FX & Indexation Impact Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <Label className="text-muted-foreground">FX Rate</Label>
              <p className="text-2xl font-bold">
                {fxData.usd_cop_rate.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">USD/COP</p>
            </div>
            
            <div className="text-center">
              <Label className="text-muted-foreground">Hedging Coverage</Label>
              <p className="text-2xl font-bold">
                {fxData.hedging_strategy === 'forward_80' ? '80%' :
                 fxData.hedging_strategy === 'forward_100' ? '100%' :
                 fxData.hedging_strategy === 'options' ? 'Protected' : '0%'}
              </p>
              <p className="text-sm text-muted-foreground">FX Risk Coverage</p>
            </div>

            <div className="text-center">
              <Label className="text-muted-foreground">Labor Indexation</Label>
              <p className="text-2xl font-bold text-amber-600">
                {indexationImpact.laborRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Annual Rate</p>
            </div>

            <div className="text-center">
              <Label className="text-muted-foreground">Non-Labor Indexation</Label>
              <p className="text-2xl font-bold text-amber-600">
                {indexationImpact.nonLaborRate.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Annual Rate</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-card rounded-lg">
            <h4 className="font-medium mb-2">Key Assumptions</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• FX rate sourced from {fxData.rate_source}</li>
              <li>• {getHedgingDescription(fxData.hedging_strategy)}</li>
              <li>• Indexation adjustments applied {indexationData.adjustment_frequency}</li>
              <li>• Labor costs indexed to {indexationData.labor_indexation === 'none' ? 'no indexation' : indexationData.labor_indexation}</li>
              <li>• Non-labor costs indexed to {indexationData.non_labor_indexation === 'none' ? 'no indexation' : indexationData.non_labor_indexation}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} className="gap-2">
          Continue to Review & Sign
        </Button>
      </div>
    </div>
  );
}

export default FXIndexationStep;