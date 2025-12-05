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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Server, CreditCard } from "lucide-react";
import type { NonLaborEstimate, Currency } from "@/types/domain";

const CATEGORIES = [
  "Support",
  "Infrastructure Services",
  "Premium Services",
  "Standard Services",
  "Basic Services",
  "Operation Services",
  "Admin Services",
  "Training Services",
];

const COMMON_ITEMS = {
  Support: [
    "Ikusi Platinum",
    "Ikusi Gold",
    "Ikusi Premium",
    "Ikusi Star",
    "Ikusi Go",
  ],
  "Infrastructure Services": [
    "Cloud Infrastructure Management",
    "Database Administration",
    "Network Operations",
    "Security Management",
  ],
  "Premium Services": [
    "Ikusi Platinum Advanced Support",
    "System Architecture Consulting",
    "Performance Optimization",
    "Security Audits",
  ],
  "Standard Services": [
    "Ikusi Gold Standard Support",
    "Regular Maintenance",
    "Basic Monitoring",
    "Standard Updates",
  ],
  "Basic Services": [
    "Ikusi Go Entry Support",
    "Basic Setup",
    "Documentation",
    "Initial Configuration",
  ],
  "Operation Services": [
    "System Operations",
    "24/7 Monitoring",
    "Incident Response",
    "Performance Management",
  ],
  "Admin Services": [
    "System Administration",
    "User Management",
    "Configuration Management",
    "Backup Services",
  ],
  "Training Services": [
    "User Training",
    "Admin Training",
    "Technical Documentation",
    "Knowledge Transfer",
  ],
};

interface NonLaborStepProps {
  data: NonLaborEstimate[];
  setData: (data: NonLaborEstimate[]) => void;
  onNext: () => void;
  onPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function NonLaborStep({ data, setData, onNext }: NonLaborStepProps) {
  const [nonLaborEstimates, setNonLaborEstimates] = useState<
    NonLaborEstimate[]
  >(data.length > 0 ? data : []);

  const addNonLaborItem = () => {
    const newItem: NonLaborEstimate = {
      category: "",
      description: "",
      amount: 0,
      currency: "USD",
      one_time: true,
      start_month: 1,
      end_month: 1,
      vendor: "",
      capex_flag: false,
    };
    setNonLaborEstimates([...nonLaborEstimates, newItem]);
    console.log(
      "➕ Non-labor item added, total count:",
      nonLaborEstimates.length + 1
    );
  };

  const updateNonLaborItem = (
    index: number,
    field: keyof NonLaborEstimate,
    value: any
  ) => {
    const updated = [...nonLaborEstimates];
    updated[index] = { ...updated[index], [field]: value };
    setNonLaborEstimates(updated);
    console.log("✏️  Non-labor item updated:", {
      index,
      category: updated[index].category,
      description: updated[index].description,
      amount: updated[index].amount,
      isOneTime: updated[index].one_time,
      isCapex: updated[index].capex_flag,
      fieldChanged: field,
    });
  };

  const removeNonLaborItem = (index: number) => {
    const removed = nonLaborEstimates[index];
    setNonLaborEstimates(nonLaborEstimates.filter((_, i) => i !== index));
    console.log("🗑️  Non-labor item removed:", {
      index,
      category: removed.category,
      description: removed.description,
      remainingCount: nonLaborEstimates.length - 1,
    });
  };

  const calculateItemTotal = (item: NonLaborEstimate) => {
    if (item.one_time) {
      return item.amount;
    }
    const duration = item.end_month! - item.start_month! + 1;
    return item.amount * duration;
  };

  const getTotalCost = () => {
    return nonLaborEstimates.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );
  };

  const getCapexTotal = () => {
    return nonLaborEstimates
      .filter((item) => item.capex_flag)
      .reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleNext = () => {
    const totalCost = getTotalCost();
    const capexTotal = getCapexTotal();
    console.log("🏗️  Non-labor estimates submitted:", {
      itemCount: nonLaborEstimates.length,
      totalCost,
      capexTotal,
      opexTotal: totalCost - capexTotal,
      items: nonLaborEstimates.map((item) => ({
        category: item.category,
        description: item.description,
        amount: item.amount,
        isOneTime: item.one_time,
        isCapex: item.capex_flag,
      })),
      timestamp: new Date().toISOString(),
    });
    setData(nonLaborEstimates);
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Non-Labor Costs</h2>
        <p className="text-muted-foreground">
          Add infrastructure, software licenses, and other non-labor expenses
        </p>
      </div>

      {/* Add Non-Labor Item */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Cost Items</h3>
          <p className="text-sm text-muted-foreground">
            Include all non-labor expenses for the project
          </p>
        </div>
        <Button onClick={addNonLaborItem} className="gap-2">
          <Plus size={16} />
          Add Cost Item
        </Button>
      </div>

      {/* Non-Labor Items Table */}
      {nonLaborEstimates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>One-time</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>CapEx</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonLaborEstimates.map((item, index) => {
                    const baseId = `nonlabor-${index}`;
                    const categoryId = `${baseId}-category`;
                    const descriptionId = `${baseId}-description`;
                    const amountId = `${baseId}-amount`;
                    const startId = `${baseId}-start`;
                    const endId = `${baseId}-end`;
                    const vendorId = `${baseId}-vendor`;

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Label className="sr-only" htmlFor={categoryId}>
                            Category
                          </Label>
                          <Select
                            value={item.category}
                            onValueChange={(value) =>
                              updateNonLaborItem(index, "category", value)
                            }
                          >
                            <SelectTrigger
                              id={categoryId}
                              name={categoryId}
                              className="w-[140px]"
                            >
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={descriptionId}>
                            Description
                          </Label>
                          <Input
                            id={descriptionId}
                            name={descriptionId}
                            value={item.description}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="e.g., AWS EC2 instances"
                            className="w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={amountId}>
                            Amount
                          </Label>
                          <Input
                            id={amountId}
                            name={amountId}
                            type="number"
                            value={item.amount}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "amount",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            id={`one-time-${index}`}
                            checked={item.one_time}
                            onCheckedChange={(checked) =>
                              updateNonLaborItem(index, "one_time", checked)
                            }
                            aria-label="One-time expense"
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
                            value={item.start_month || 1}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "start_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                            disabled={item.one_time}
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
                            value={item.end_month || 1}
                            onChange={(e) =>
                              updateNonLaborItem(
                                index,
                                "end_month",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16"
                            min="1"
                            disabled={item.one_time}
                          />
                        </TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={vendorId}>
                            Vendor
                          </Label>
                          <Input
                            id={vendorId}
                            name={vendorId}
                            value={item.vendor || ""}
                            onChange={(e) =>
                              updateNonLaborItem(index, "vendor", e.target.value)
                            }
                            placeholder="Vendor name"
                            className="w-[120px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            id={`capex-${index}`}
                            checked={item.capex_flag}
                            onCheckedChange={(checked) =>
                              updateNonLaborItem(index, "capex_flag", checked)
                            }
                            aria-label="CapEx"
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
                            onClick={() => removeNonLaborItem(index)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remove non-labor item ${index + 1}`}
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
            <Server size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No cost items added</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add infrastructure, software licenses, and other non-labor costs
            </p>
            <Button onClick={addNonLaborItem} className="gap-2">
              <Plus size={16} />
              Add First Cost Item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Add Common Items */}
      {nonLaborEstimates.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Add Common Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(COMMON_ITEMS).map(([category, items]) => (
                <div key={category}>
                  <h4 className="font-medium mb-2">{category}</h4>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Button
                        key={item}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => {
                          const newItem: NonLaborEstimate = {
                            category,
                            description: item,
                            amount: 1000,
                            currency: "USD",
                            one_time: true,
                            capex_flag: false,
                          };
                          setNonLaborEstimates([newItem]);
                        }}
                      >
                        <Plus size={12} className="mr-1" />
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {nonLaborEstimates.length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} />
              Non-Labor Cost Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Total Items</Label>
                <p className="text-2xl font-bold">{nonLaborEstimates.length}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">One-time Costs</Label>
                <p className="text-2xl font-bold">
                  $
                  {nonLaborEstimates
                    .filter((item) => item.one_time)
                    .reduce((sum, item) => sum + item.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">CapEx Total</Label>
                <p className="text-2xl font-bold text-amber-600">
                  ${getCapexTotal().toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Non-Labor</Label>
                <p className="text-3xl font-bold text-primary">
                  ${getTotalCost().toLocaleString()}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mt-4">
              <Label className="text-muted-foreground">By Category</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {CATEGORIES.map((category) => {
                  const categoryTotal = nonLaborEstimates
                    .filter((item) => item.category === category)
                    .reduce((sum, item) => sum + calculateItemTotal(item), 0);

                  if (categoryTotal === 0) return null;

                  return (
                    <Badge
                      key={category}
                      variant="outline"
                      className="justify-between"
                    >
                      <span className="text-xs">{category}:</span>
                      <span className="font-medium">
                        ${categoryTotal.toLocaleString()}
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleNext} className="gap-2">
          Continue to FX & Indexation
        </Button>
      </div>
    </div>
  );
}

export default NonLaborStep;
