import React, { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star,
  Clock,
  Users,
  Shield,
  Zap,
  TrendingUp,
  Calculator,
  CheckCircle,
} from "lucide-react";
import {
  IkusiPricingCalculator,
  type PricingRecommendation,
} from "@/lib/pricing-calculator";
import { useProject } from "@/contexts/ProjectContext";
import { addProjectRubro } from "@/api/finanzas";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Import the service catalog
import serviceCatalog from "@/mocks/ikusi-service-catalog.json";

interface ServiceTier {
  id: string;
  name: string;
  tier: string;
  description: string;
  base_price: number;
  features?: {
    core_services?: string[];
    technical_specs?: {
      support_hours?: string;
      sla_uptime?: string;
      [key: string]: string | number | undefined;
    };
  };
  [key: string]: unknown;
}

interface ServiceTierCardProps {
  tier: ServiceTier;
  isRecommended?: boolean;
  onSelect?: (tierId: string) => void;
}

const ServiceTierCard: React.FC<ServiceTierCardProps> = ({
  tier,
  isRecommended,
  onSelect,
}) => {
  const getTierColor = (tierLevel: string) => {
    const colors = {
      Essential: "bg-blue-50 border-blue-200 text-blue-800",
      Professional: "bg-green-50 border-green-200 text-green-800",
      Enterprise: "bg-purple-50 border-purple-200 text-purple-800",
      "Premium Enterprise": "bg-orange-50 border-orange-200 text-orange-800",
      "Strategic Partnership": "bg-red-50 border-red-200 text-red-800",
    };
    return (
      colors[tierLevel as keyof typeof colors] ||
      "bg-gray-50 border-gray-200 text-gray-800"
    );
  };

  const getTierIcon = (tierLevel: string) => {
    const icons = {
      Essential: <Zap className="w-4 h-4" />,
      Professional: <TrendingUp className="w-4 h-4" />,
      Enterprise: <Shield className="w-4 h-4" />,
      "Premium Enterprise": <Star className="w-4 h-4" />,
      "Strategic Partnership": <Users className="w-4 h-4" />,
    };
    return (
      icons[tierLevel as keyof typeof icons] || (
        <CheckCircle className="w-4 h-4" />
      )
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriceRange = (pricingTiers: any[]) => {
    if (pricingTiers.length === 1) {
      return formatCurrency(pricingTiers[0].unit_price);
    }
    const minPrice = Math.min(...pricingTiers.map((pt) => pt.unit_price));
    const maxPrice = Math.max(...pricingTiers.map((pt) => pt.unit_price));
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
  };

  return (
    <Card
      className={`relative transition-all duration-200 hover:shadow-lg ${
        isRecommended ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground font-semibold">
            Recommended
          </Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getTierIcon(tier.tier)}
            <CardTitle className="text-xl">{tier.name}</CardTitle>
          </div>
          <Badge className={getTierColor(tier.tier)}>{tier.tier}</Badge>
        </div>
        <CardDescription className="text-sm">
          {tier.description}
        </CardDescription>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-primary">
              {getPriceRange(tier.pricing_tiers)}
            </span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          {tier.setup_fee > 0 && (
            <div className="text-sm text-muted-foreground">
              Setup fee: {formatCurrency(tier.setup_fee)}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Minimum commitment: {tier.minimum_commitment_months} months
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Technical Specs */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3 text-green-600" />
              <span>SLA: {tier.features.technical_specs.sla_uptime}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>
                {tier.features.technical_specs.response_time} response
              </span>
            </div>
          </div>

          {/* Key Features */}
          <div>
            <h4 className="font-medium text-sm mb-2">Key Features:</h4>
            <ul className="text-xs space-y-1">
              {tier.features.core_services
                .slice(0, 4)
                .map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start space-x-1">
                    <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              {tier.features.core_services.length > 4 && (
                <li className="text-muted-foreground italic">
                  +{tier.features.core_services.length - 4} more features
                </li>
              )}
            </ul>
          </div>

          {/* Target Market */}
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <strong>Best for:</strong> {tier.target_market}
            </div>
          </div>

          {/* Action Button */}
          <Button
            className="w-full"
            variant={isRecommended ? "default" : "outline"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("🎯 ServiceTierCard: Tier selected -", tier.name);
              onSelect?.(tier.id);
            }}
          >
            Select {tier.name}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface ServiceTierRecommendationProps {
  recommendation: PricingRecommendation;
  onApplyRecommendation?: () => void;
}

const ServiceTierRecommendation: React.FC<ServiceTierRecommendationProps> = ({
  recommendation,
  onApplyRecommendation,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-green-600" />
          <CardTitle className="text-green-800">
            Recommended Service Tier
          </CardTitle>
        </div>
        <CardDescription>
          Based on your requirements, we recommend{" "}
          <strong>{recommendation.recommended_tier}</strong>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Cost Summary */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-white rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Monthly Cost</div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(recommendation.monthly_cost)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Annual Cost</div>
              <div className="text-xl font-semibold text-green-600">
                {formatCurrency(recommendation.annual_cost)}
              </div>
            </div>
          </div>

          {/* Savings */}
          {recommendation.total_savings > 0 && (
            <div className="p-3 bg-green-100 rounded-lg">
              <div className="flex items-center space-x-1 text-green-800">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Potential Savings</span>
              </div>
              <div className="text-lg font-semibold text-green-700">
                {formatCurrency(recommendation.total_savings)}
              </div>
              <div className="text-xs text-green-600">
                vs. higher-tier alternatives
              </div>
            </div>
          )}

          {/* Volume Discount */}
          {recommendation.volume_discount_applied > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <Badge variant="secondary">
                {recommendation.volume_discount_applied}% Volume Discount
                Applied
              </Badge>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h4 className="font-medium text-sm mb-2">Why this tier fits:</h4>
            <ul className="text-xs space-y-1">
              {recommendation.reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start space-x-1">
                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Alternative Options */}
          {recommendation.alternative_options.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">
                Alternative considerations:
              </h4>
              <div className="space-y-2">
                {recommendation.alternative_options
                  .slice(0, 2)
                  .map((alt, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">{alt.tier}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(alt.monthly_cost)}/month
                        </span>
                      </div>
                      {alt.pros.length > 0 && (
                        <div className="text-xs">
                          <span className="text-green-600">Pros:</span>{" "}
                          {alt.pros.slice(0, 1).join(", ")}
                        </div>
                      )}
                      {alt.cons.length > 0 && (
                        <div className="text-xs">
                          <span className="text-red-600">Cons:</span>{" "}
                          {alt.cons.slice(0, 1).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <Button className="w-full" onClick={onApplyRecommendation}>
            Apply Recommendation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface ServiceTierSelectorProps {
  onTierSelected?: (tierId: string, tierData: ServiceTier) => void;
}

export const ServiceTierSelector: React.FC<ServiceTierSelectorProps> = ({
  onTierSelected,
}) => {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const queryClient = useQueryClient();
  const [selectedRequirements, setSelectedRequirements] = useState({
    budget_monthly: 10000,
    commitment_months: 12,
    required_sla: "99%",
    support_hours: "business" as const,
    complexity: "medium" as const,
  });

  // Memoize calculator instance
  const calculator = useMemo(
    () => new IkusiPricingCalculator(serviceCatalog),
    []
  );

  // Recalculate recommendation whenever requirements change
  const recommendation = useMemo(
    () => calculator.recommendServiceTier(selectedRequirements),
    [calculator, selectedRequirements]
  );

  const comparisonMatrix = useMemo(
    () => calculator.generateComparisonMatrix(),
    [calculator]
  );

  const handleTierSelect = async (tierId: string) => {
    console.log("🎯 ServiceTierSelector: Tier selected -", tierId);
    const tierData = serviceCatalog.service_tiers.find((t) => t.id === tierId);
    console.log("📊 Tier data:", tierData);

    // Guard: need project ID to create line item
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }

    if (!tierData) {
      toast.error("Tier data not found");
      return;
    }

    try {
      // Calculate unit cost (use first pricing tier)
      const unitCost = tierData.pricing_tiers[0]?.unit_price || 0;

      // POST to API to create line item
      await addProjectRubro(projectId, {
        rubroId: tierId,
        qty: 1,
        unitCost,
        type: "Recurring",
        duration: `M1-${tierData.minimum_commitment_months || 12}`,
      });

      // Invalidate queries to refresh line items
      await queryClient.invalidateQueries({
        queryKey: ["lineItems", projectId],
      });

      toast.success(`Added ${tierData.name} to project`);

      // Call parent callback if provided
      onTierSelected?.(tierId, tierData);
      console.log("✅ onTierSelected callback executed with:", tierId);
    } catch (error) {
      console.error("Failed to create line item:", error);
      toast.error("Failed to add tier to project. Please try again.");
    }
  };

  const handleApplyRecommendation = () => {
    const recommendedTier = serviceCatalog.service_tiers.find(
      (t) => t.name === recommendation.recommended_tier
    );
    if (recommendedTier) {
      handleTierSelect(recommendedTier.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Ikusi Service Tiers
        </h2>
        <p className="text-muted-foreground">
          Choose the perfect service level for your project needs
        </p>
      </div>

      <Tabs defaultValue="tiers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tiers">Service Tiers</TabsTrigger>
          <TabsTrigger value="recommendation">Get Recommendation</TabsTrigger>
          <TabsTrigger value="comparison">Compare Features</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceCatalog.service_tiers.map((tier) => (
              <ServiceTierCard
                key={tier.id}
                tier={tier}
                isRecommended={tier.name === recommendation.recommended_tier}
                onSelect={handleTierSelect}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tell us about your requirements</CardTitle>
                <CardDescription>
                  We'll recommend the best service tier for your needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">
                      Monthly Budget
                    </label>
                    <input
                      type="number"
                      value={selectedRequirements.budget_monthly}
                      onChange={(e) =>
                        setSelectedRequirements((prev) => ({
                          ...prev,
                          budget_monthly: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                      placeholder="10000"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Contract Length
                    </label>
                    <select
                      value={selectedRequirements.commitment_months}
                      onChange={(e) =>
                        setSelectedRequirements((prev) => ({
                          ...prev,
                          commitment_months: parseInt(e.target.value),
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                    >
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>12 months</option>
                      <option value={24}>24 months</option>
                      <option value={36}>36 months</option>
                      <option value={48}>48 months</option>
                      <option value={60}>60 months</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Required SLA</label>
                    <select
                      value={selectedRequirements.required_sla}
                      onChange={(e) =>
                        setSelectedRequirements((prev) => ({
                          ...prev,
                          required_sla: e.target.value,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                    >
                      <option value="95%">95% uptime</option>
                      <option value="98%">98% uptime</option>
                      <option value="99%">99% uptime</option>
                      <option value="99.5%">99.5% uptime</option>
                      <option value="99.9%">99.9% uptime</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Support Hours</label>
                    <select
                      value={selectedRequirements.support_hours}
                      onChange={(e) =>
                        setSelectedRequirements((prev) => ({
                          ...prev,
                          support_hours: e.target.value as any,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                    >
                      <option value="business">Business Hours</option>
                      <option value="extended">Extended Hours</option>
                      <option value="24x7">24/7 Coverage</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Project Complexity
                    </label>
                    <select
                      value={selectedRequirements.complexity}
                      onChange={(e) =>
                        setSelectedRequirements((prev) => ({
                          ...prev,
                          complexity: e.target.value as any,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                    >
                      <option value="low">Low Complexity</option>
                      <option value="medium">Medium Complexity</option>
                      <option value="high">High Complexity</option>
                      <option value="enterprise">Enterprise Scale</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <ServiceTierRecommendation
              recommendation={recommendation}
              onApplyRecommendation={handleApplyRecommendation}
            />
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Tier Comparison</CardTitle>
              <CardDescription>
                Compare features and pricing across all service tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2">Service Tier</th>
                      <th className="text-left p-2">Monthly Cost</th>
                      <th className="text-left p-2">SLA</th>
                      <th className="text-left p-2">Support Model</th>
                      <th className="text-left p-2">Best For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonMatrix.map((tier, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border hover:bg-muted/50"
                      >
                        <td className="p-2">
                          <div className="font-medium">{tier.tier}</div>
                        </td>
                        <td className="p-2">{tier.monthly_cost_range}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {tier.sla}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">{tier.support}</td>
                        <td className="p-2 text-xs">{tier.use_case}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
