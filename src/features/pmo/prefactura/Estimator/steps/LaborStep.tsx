import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Calculator } from "lucide-react";
import type { LaborEstimate } from "@/types/domain";
import { useModRoles } from "@/hooks/useModRoles";

// Labor rate presets by country and role
const LABOR_PRESETS = {
  Colombia: {
    junior: { rate: 2500, on_cost: 25 },
    mid: { rate: 4000, on_cost: 25 },
    senior: { rate: 6000, on_cost: 25 },
    lead: { rate: 8500, on_cost: 30 },
  },
  USA: {
    junior: { rate: 6000, on_cost: 35 },
    mid: { rate: 9000, on_cost: 35 },
    senior: { rate: 12000, on_cost: 35 },
    lead: { rate: 15000, on_cost: 40 },
  },
  Mexico: {
    junior: { rate: 3000, on_cost: 30 },
    mid: { rate: 5000, on_cost: 30 },
    senior: { rate: 7500, on_cost: 30 },
    lead: { rate: 10000, on_cost: 35 },
  },
};

/**
 * Labor roles are now sourced from MOD (Mano de Obra Directa) taxonomy
 * defined in src/modules/modRoles.ts and aligned with Rubros catalog.
 * 
 * This ensures consistency between:
 * - PMO Estimator (this component)
 * - SDMT Cost Management (catalog, forecast, changes)
 * - Backend payroll and cost tracking
 * 
 * The MOD roles are:
 * - Ingeniero Delivery (Lead Engineer)
 * - Ingeniero Soporte N1/N2/N3 (Support Engineers)
 * - Service Delivery Manager
 * - Project Manager
 */

interface LaborStepProps {
  data: LaborEstimate[];
  setData: (data: LaborEstimate[]) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function LaborStep({ data, setData, onNext }: LaborStepProps) {
  // Fetch MOD roles from Rubros taxonomy
  const { roles: modRoles, loading: rolesLoading } = useModRoles();
  
  const [laborEstimates, setLaborEstimates] = useState<LaborEstimate[]>(
    data.length > 0 ? data : []
  );

  const addLaborItem = () => {
    const newItem: LaborEstimate = {
      role: "",
      country: "Colombia",
      level: "mid",
      fte_count: 1,
      hourly_rate: 0,
      hours_per_month: 160,
      on_cost_percentage: 25,
      start_month: 1,
      end_month: 12,
    };
    setLaborEstimates([...laborEstimates, newItem]);
    console.log("➕ Labor item added, total count:", laborEstimates.length + 1);
  };

  const updateLaborItem = (
    index: number,
    field: keyof LaborEstimate,
    value: string | number
  ) => {
    const updated = [...laborEstimates];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-update hourly rate if country/level changes
    if (field === "country" || field === "level") {
      const country = field === "country" ? value : updated[index].country;
      const level = field === "level" ? value : updated[index].level;
      const preset =
        LABOR_PRESETS[country as keyof typeof LABOR_PRESETS]?.[
          level as keyof (typeof LABOR_PRESETS)["Colombia"]
        ];
      if (preset) {
        updated[index].hourly_rate = preset.rate;
        updated[index].on_cost_percentage = preset.on_cost;
      }
    }

    setLaborEstimates(updated);
    console.log("✏️  Labor item updated:", {
      index,
      role: updated[index].role,
      country: updated[index].country,
      level: updated[index].level,
      fteCount: updated[index].fte_count,
      hourlyRate: updated[index].hourly_rate,
      fieldChanged: field,
    });
  };

  const removeLaborItem = (index: number) => {
    const removed = laborEstimates[index];
    setLaborEstimates(laborEstimates.filter((_, i) => i !== index));
    console.log("🗑️  Labor item removed:", {
      index,
      role: removed.role,
      remainingCount: laborEstimates.length - 1,
    });
  };

  const calculateItemTotal = (item: LaborEstimate) => {
    const baseHours = item.hours_per_month * item.fte_count;
    const baseCost = baseHours * item.hourly_rate;
    const onCost = baseCost * (item.on_cost_percentage / 100);
    const monthlyTotal = baseCost + onCost;
    const duration = item.end_month - item.start_month + 1;
    return monthlyTotal * duration;
  };

  const getTotalCost = () => {
    return laborEstimates.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );
  };

  const handleNext = () => {
    const totalCost = getTotalCost();
    console.log("💼 Labor estimates submitted:", {
      itemCount: laborEstimates.length,
      totalCost,
      averageCostPerRole: totalCost / (laborEstimates.length || 1),
      roles: laborEstimates.map((l) => ({
        role: l.role,
        fteCount: l.fte_count,
        monthlyRate: l.hourly_rate * l.hours_per_month,
      })),
      timestamp: new Date().toISOString(),
    });
    setData(laborEstimates);
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Labor Cost Estimation</h2>
        <p className="text-muted-foreground">
          Define your team composition, rates, and duration for accurate labor
          cost projections
        </p>
      </div>

      {/* Add Labor Item */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Add roles with their associated costs and duration
          </p>
        </div>
        <Button onClick={addLaborItem} className="gap-2">
          <Plus size={16} />
          Add Team Member
        </Button>
      </div>

      {/* Labor Items Table */}
      {laborEstimates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>FTE</TableHead>
                    <TableHead>Rate/Hour</TableHead>
                    <TableHead>Hours/Month</TableHead>
                    <TableHead>On-Cost %</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborEstimates.map((item, index) => {
                    const baseId = `labor-${index}`;
                    const roleId = `${baseId}-role`;
                    const countryId = `${baseId}-country`;
                    const levelId = `${baseId}-level`;
                    const fteId = `${baseId}-fte`;
                    const rateId = `${baseId}-rate`;
                    const hoursId = `${baseId}-hours`;
                    const onCostId = `${baseId}-oncost`;
                    const startId = `${baseId}-start`;
                    const endId = `${baseId}-end`;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Label className="sr-only" htmlFor={roleId}>
                            Role
                          </Label>
                          <Select
                            value={item.role}
                            onValueChange={(value) =>
                              updateLaborItem(index, "role", value)
                            }
                            disabled={rolesLoading}
                          >
                            <SelectTrigger id={roleId} className="w-40" name={roleId}>
                              <SelectValue 
                                placeholder={
                                  rolesLoading ? "Loading roles..." : "Select role"
                                } 
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {modRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={countryId}>
                            Country
                          </Label>
                          <Select
                            value={item.country}
                            onValueChange={(value) =>
                              updateLaborItem(index, "country", value)
                            }
                          >
                            <SelectTrigger
                              id={countryId}
                              name={countryId}
                              className="w-[120px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(LABOR_PRESETS).map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={levelId}>
                            Level
                          </Label>
                          <Select
                            value={item.level}
                            onValueChange={(value) =>
                              updateLaborItem(index, "level", value)
                            }
                          >
                            <SelectTrigger
                              id={levelId}
                              name={levelId}
                              className="w-[100px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="junior">Junior</SelectItem>
                              <SelectItem value="mid">Mid</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={fteId}>
                            FTE Count
                          </Label>
                          <Input
                            id={fteId}
                            name={fteId}
                            type="number"
                            value={item.fte_count}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "fte_count",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16"
                            min="0.1"
                            step="0.1"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={rateId}>
                            Hourly rate
                          </Label>
                          <Input
                            id={rateId}
                            name={rateId}
                            type="number"
                            value={item.hourly_rate}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "hourly_rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={hoursId}>
                            Hours per month
                          </Label>
                          <Input
                            id={hoursId}
                            name={hoursId}
                            type="number"
                            value={item.hours_per_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "hours_per_month",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={onCostId}>
                            On-cost percentage
                          </Label>
                          <Input
                            id={onCostId}
                            name={onCostId}
                            type="number"
                            value={item.on_cost_percentage}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "on_cost_percentage",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={startId}>
                            Start month
                          </Label>
                          <Input
                            id={startId}
                            name={startId}
                            type="number"
                            value={item.start_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "start_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={endId}>
                            End month
                          </Label>
                          <Input
                            id={endId}
                            name={endId}
                            type="number"
                            value={item.end_month}
                            onChange={(e) =>
                              updateLaborItem(
                                index,
                                "end_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            ${calculateItemTotal(item).toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLaborItem(index)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remove labor role ${item.role || index + 1}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calculator size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No team members added</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by adding team members to estimate labor costs for your
              project
            </p>
            <Button onClick={addLaborItem} className="gap-2">
              <Plus size={16} />
              Add First Team Member
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {laborEstimates.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator size={20} />
              Labor Cost Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Total Team Size</Label>
                <p className="text-2xl font-bold">
                  {laborEstimates.reduce(
                    (sum, item) => sum + item.fte_count,
                    0
                  )}{" "}
                  FTE
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Avg. Monthly Rate
                </Label>
                <p className="text-2xl font-bold">
                  $
                  {(
                    laborEstimates.reduce(
                      (sum, item) => sum + item.hourly_rate,
                      0
                    ) / laborEstimates.length
                  ).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Total Labor Cost
                </Label>
                <p className="text-3xl font-bold text-primary">
                  ${getTotalCost().toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Unique Roles</Label>
                <p className="text-2xl font-bold">
                  {new Set(laborEstimates.map((item) => item.role)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={laborEstimates.length === 0}
          className="gap-2"
        >
          Continue to Non-Labor Costs
        </Button>
      </div>
    </div>
  );
}

export default LaborStep;
