import { useState, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
import { Upload, Download, AlertTriangle, CheckCircle, X, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LineItem, ForecastCell } from '@/types/domain';
import { toast } from 'sonner';

export interface ImportValidationResult {
  isValid: boolean;
  errors: Array<{
    row: number;
    column: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    row: number;
    column: string;
    message: string;
  }>;
  mappedData: any[];
  stats: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
}

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: any) => any;
  required: boolean;
}

interface ImportWizardProps {
  onImportComplete: (data: any[], report: ImportValidationResult) => void;
  targetSchema: 'lineItems' | 'forecast' | 'invoices';
  className?: string;
}

/**
 * Advanced Import Wizard with mapping and validation
 */
export const ImportWizard: FC<ImportWizardProps> = ({
  onImportComplete,
  targetSchema,
  className
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'results'>('upload');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Schema definitions for different target types
  const schemas = {
    lineItems: {
      required: ['description', 'category', 'qty', 'unit_cost', 'currency'],
      optional: ['subtype', 'vendor', 'start_month', 'end_month', 'cost_center', 'notes']
    },
    forecast: {
      required: ['line_item_id', 'month', 'planned', 'forecast'],
      optional: ['actual', 'variance_reason', 'notes']
    },
    invoices: {
      required: ['line_item_id', 'month', 'amount'],
      optional: ['invoice_number', 'status', 'comments']
    }
  };

  const currentSchema = schemas[targetSchema];

  // Get transform function for different field types
  const getFieldTransform = (field: string) => {
    switch (field) {
      case 'qty':
      case 'unit_cost':
      case 'planned':
      case 'forecast':
      case 'actual':
        return (value: any) => parseFloat(value) || 0;
      case 'start_month':
      case 'end_month':
      case 'month':
        return (value: any) => parseInt(value) || 1;
      case 'one_time':
      case 'recurring':
      case 'capex_flag':
        return (value: any) => value?.toLowerCase() === 'true' || value === '1';
      default:
        return (value: any) => value?.toString() || '';
    }
  };

  // Auto-suggest field mappings based on column names
  const autoSuggestMappings = (headers: string[], schema: any): FieldMapping[] => {
    const mappings: FieldMapping[] = [];
    
    [...schema.required, ...schema.optional].forEach(field => {
      const matchingHeader = headers.find(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        field.toLowerCase().includes(header.toLowerCase())
      );
      
      if (matchingHeader) {
        mappings.push({
          sourceColumn: matchingHeader,
          targetField: field,
          required: schema.required.includes(field),
          transform: getFieldTransform(field)
        });
      } else if (schema.required.includes(field)) {
        mappings.push({
          sourceColumn: '',
          targetField: field,
          required: true,
          transform: getFieldTransform(field)
        });
      }
    });

    return mappings;
  };

  // Validate and transform imported data
  const validateAndTransformData = async (
    data: any[][],
    mappings: FieldMapping[],
    schema: any
  ): Promise<ImportValidationResult> => {
    const errors: ImportValidationResult['errors'] = [];
    const warnings: ImportValidationResult['warnings'] = [];
    const mappedData: any[] = [];

    // Create column index map
    const columnMap = new Map<string, number>();
    headers.forEach((header, index) => {
      columnMap.set(header, index);
    });

    // Process each row
    data.forEach((row, rowIndex) => {
      const record: any = {};
      let hasErrors = false;

      mappings.forEach(mapping => {
        if (!mapping.sourceColumn && mapping.required) {
          errors.push({
            row: rowIndex + 1,
            column: mapping.targetField,
            message: 'Required field not mapped',
            severity: 'error'
          });
          hasErrors = true;
          return;
        }

        const colIndex = columnMap.get(mapping.sourceColumn);
        if (colIndex === undefined) return;

        const rawValue = row[colIndex];
        
        try {
          const transformedValue = mapping.transform ? mapping.transform(rawValue) : rawValue;
          record[mapping.targetField] = transformedValue;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            column: mapping.targetField,
            message: 'Failed to transform value',
            severity: 'error'
          });
          hasErrors = true;
        }
      });

      if (!hasErrors) {
        mappedData.push(record);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      mappedData,
      stats: {
        totalRows: data.length,
        validRows: mappedData.length,
        errorRows: data.length - mappedData.length,
        warningRows: warnings.length
      }
    };
  };

  // File upload handler
  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.split(','));
        
        if (rows.length > 0) {
          setHeaders(rows[0].map(h => h.trim().replace(/"/g, '')));
          setRawData(rows.slice(1).filter(row => row.some(cell => cell.trim())));
          setStep('mapping');
          
          // Auto-suggest mappings based on column names
          const suggestedMappings = autoSuggestMappings(rows[0], currentSchema);
          setFieldMappings(suggestedMappings);
        }
      } catch (error) {
        toast.error('Failed to parse CSV file. Please check the format.');
      }
    };
    
    reader.readAsText(file);
  }, [currentSchema]);

  // Update field mapping
  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    setFieldMappings(newMappings);
  };

  // Validate and process data
  const processData = async () => {
    setIsProcessing(true);
    
    try {
      const result = await validateAndTransformData(rawData, fieldMappings, currentSchema);
      setValidationResult(result);
      setStep('validation');
    } catch (error) {
      toast.error('Failed to process data. Please check your mappings.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Complete import process
  const completeImport = () => {
    if (validationResult && validationResult.isValid) {
      onImportComplete(validationResult.mappedData, validationResult);
      toast.success(`Successfully imported ${validationResult.stats.validRows} records`);
      setStep('results');
    }
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Import {targetSchema.charAt(0).toUpperCase() + targetSchema.slice(1)}</span>
        </CardTitle>
        <CardDescription>
          Upload and validate your data with our advanced import wizard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" disabled={step !== 'upload'}>Upload</TabsTrigger>
            <TabsTrigger value="mapping" disabled={step === 'upload'}>Mapping</TabsTrigger>
            <TabsTrigger value="validation" disabled={!validationResult}>Validation</TabsTrigger>
            <TabsTrigger value="results" disabled={step !== 'results'}>Results</TabsTrigger>
          </TabsList>

          {/* Upload Step */}
          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Upload your CSV file</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a CSV file containing your {targetSchema} data
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </label>
            </div>

            {/* Required fields info */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Required Fields</AlertTitle>
              <AlertDescription>
                Your CSV file should include these columns: {currentSchema.required.join(', ')}
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Mapping Step */}
          <TabsContent value="mapping" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Map Your Fields</h3>
              <Badge variant="outline">
                {rawData.length} rows detected
              </Badge>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-4">
                {fieldMappings.map((mapping, index) => (
                  <div key={mapping.targetField} className="grid grid-cols-3 gap-4 items-center p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">
                        {mapping.targetField}
                        {mapping.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <p className="text-xs text-muted-foreground">Target field</p>
                    </div>
                    
                    <Select 
                      value={mapping.sourceColumn} 
                      onValueChange={(value) => updateFieldMapping(index, { sourceColumn: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map(header => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="text-right">
                      {mapping.required && !mapping.sourceColumn && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                      {mapping.sourceColumn && (
                        <Badge variant="secondary" className="text-xs">Mapped</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={processData} disabled={isProcessing}>
                {isProcessing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />}
                Validate Data
              </Button>
            </div>
          </TabsContent>

          {/* Validation Step */}
          <TabsContent value="validation" className="space-y-4">
            {validationResult && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{validationResult.stats.totalRows}</div>
                      <p className="text-xs text-muted-foreground">Total Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{validationResult.stats.validRows}</div>
                      <p className="text-xs text-muted-foreground">Valid Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{validationResult.stats.errorRows}</div>
                      <p className="text-xs text-muted-foreground">Error Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-yellow-600">{validationResult.stats.warningRows}</div>
                      <p className="text-xs text-muted-foreground">Warnings</p>
                    </CardContent>
                  </Card>
                </div>

                <Progress value={(validationResult.stats.validRows / validationResult.stats.totalRows) * 100} />

                {validationResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Validation Errors Found</AlertTitle>
                    <AlertDescription>
                      {validationResult.errors.length} errors must be fixed before importing
                    </AlertDescription>
                  </Alert>
                )}

                {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...validationResult.errors.map(e => ({...e, type: e.severity})), ...validationResult.warnings.map(w => ({...w, type: 'warning', severity: 'warning' as const}))].map((issue, index) => (
                          <TableRow key={index}>
                            <TableCell>{issue.row}</TableCell>
                            <TableCell>{issue.column}</TableCell>
                            <TableCell>
                              <Badge variant={issue.severity === 'error' ? 'destructive' : 'secondary'}>
                                {issue.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{issue.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('mapping')}>
                    Back to Mapping
                  </Button>
                  <Button 
                    onClick={completeImport} 
                    disabled={!validationResult.isValid}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {validationResult.isValid ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Import Data
                      </>
                    ) : (
                      'Fix Errors First'
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Results Step */}
          <TabsContent value="results" className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Import Successful!</AlertTitle>
              <AlertDescription>
                Your data has been successfully imported and is ready for use.
              </AlertDescription>
            </Alert>
            
            {validationResult && (
              <div className="text-center space-y-4">
                <div className="text-6xl">✅</div>
                <h3 className="text-xl font-semibold">
                  {validationResult.stats.validRows} records imported successfully
                </h3>
                {validationResult.warnings.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {validationResult.warnings.length} warnings were noted during import
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};