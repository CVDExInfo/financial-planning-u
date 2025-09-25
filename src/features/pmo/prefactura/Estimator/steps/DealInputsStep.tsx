import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import type { DealInputs, Currency } from '@/types/domain.d.ts';

const dealInputsSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  project_description: z.string().optional(),
  currency: z.enum(['USD', 'COP']),
  start_date: z.string().min(1, 'Start date is required'),
  duration_months: z.number().min(1, 'Duration must be at least 1 month').max(60, 'Duration cannot exceed 60 months'),
  contract_value: z.number().optional(),
  client_name: z.string().optional(),
  assumptions: z.array(z.string()).default([])
});

interface DealInputsStepProps {
  data: DealInputs | null;
  setData: (data: DealInputs) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function DealInputsStep({ data, setData, onNext }: DealInputsStepProps) {
  const form = useForm<DealInputs>({
    resolver: zodResolver(dealInputsSchema),
    defaultValues: data || {
      project_name: '',
      project_description: '',
      currency: 'USD',
      start_date: '',
      duration_months: 12,
      contract_value: undefined,
      client_name: '',
      assumptions: []
    }
  });

  const assumptions = form.watch('assumptions') || [];

  const onSubmit = (formData: DealInputs) => {
    setData(formData);
    onNext();
  };

  const addAssumption = () => {
    const currentAssumptions = form.getValues('assumptions') || [];
    form.setValue('assumptions', [...currentAssumptions, '']);
  };

  const updateAssumption = (index: number, value: string) => {
    const currentAssumptions = form.getValues('assumptions') || [];
    const newAssumptions = [...currentAssumptions];
    newAssumptions[index] = value;
    form.setValue('assumptions', newAssumptions);
  };

  const removeAssumption = (index: number) => {
    const currentAssumptions = form.getValues('assumptions') || [];
    const newAssumptions = currentAssumptions.filter((_, i) => i !== index);
    form.setValue('assumptions', newAssumptions);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Project Information</h2>
        <p className="text-muted-foreground">
          Enter the basic project details to establish the foundation for your estimate
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Digital Platform Modernization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Currency *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="COP">COP - Colombian Peso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contract_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract Value</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 500000" 
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Months) *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="60" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="project_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the project scope, objectives, and key deliverables..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Assumptions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Project Assumptions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAssumption}
                className="gap-2"
              >
                <Plus size={16} />
                Add Assumption
              </Button>
            </div>

            <div className="space-y-2">
              {assumptions.map((assumption, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., Fixed exchange rate for duration"
                    value={assumption}
                    onChange={(e) => updateAssumption(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAssumption(index)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
              
              {assumptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No assumptions added yet</p>
                  <p className="text-sm">Click "Add Assumption" to include project assumptions</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-medium mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Currency:</span>
                <Badge className="ml-2">{form.watch('currency')}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <Badge variant="outline" className="ml-2">
                  {form.watch('duration_months')} months
                </Badge>
              </div>
              {form.watch('contract_value') && (
                <div>
                  <span className="text-muted-foreground">Value:</span>
                  <Badge variant="outline" className="ml-2">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: form.watch('currency'),
                      minimumFractionDigits: 0,
                    }).format(form.watch('contract_value') || 0)}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Assumptions:</span>
                <Badge variant="outline" className="ml-2">
                  {assumptions.filter(a => a.trim()).length}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="gap-2">
              Continue to Labor Costs
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default DealInputsStep;