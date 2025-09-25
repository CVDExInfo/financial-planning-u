/**
 * Ikusi Service Tier Pricing Calculator and Recommendations
 */

import type { LineItem } from '@/types/domain';

export interface ServiceTier {
  id: string;
  name: string;
  tier: string;
  base_price: number;
  setup_fee: number;
  minimum_commitment_months: number;
  features: {
    technical_specs: {
      sla_uptime: string;
      response_time: string;
      support_hours: string;
      included_incidents: number | string;
    };
  };
  pricing_tiers: Array<{
    volume_min: number;
    volume_max: number | null;
    unit_price: number;
    discount_pct: number;
  }>;
  add_ons: Array<{
    name: string;
    price: number;
    unit: string;
  }>;
}

export interface PricingRecommendation {
  recommended_tier: string;
  monthly_cost: number;
  annual_cost: number;
  total_savings: number;
  volume_discount_applied: number;
  reasoning: string[];
  alternative_options: Array<{
    tier: string;
    monthly_cost: number;
    pros: string[];
    cons: string[];
  }>;
}

export class IkusiPricingCalculator {
  private serviceTiers: ServiceTier[];

  constructor(serviceCatalog: any) {
    this.serviceTiers = serviceCatalog.service_tiers;
  }

  /**
   * Calculate pricing for a specific tier and volume
   */
  calculateTierPricing(tierId: string, months: number, quantity: number = 1): {
    monthly_cost: number;
    total_cost: number;
    setup_fee: number;
    discount_applied: number;
    effective_rate: number;
  } {
    const tier = this.serviceTiers.find(t => t.id === tierId);
    if (!tier) {
      throw new Error(`Service tier ${tierId} not found`);
    }

    // Find applicable volume pricing
    const volumePricing = tier.pricing_tiers.find(pt => 
      months >= pt.volume_min && 
      (pt.volume_max === null || months <= pt.volume_max)
    );

    if (!volumePricing) {
      throw new Error(`No pricing tier found for ${months} months`);
    }

    const monthly_cost = volumePricing.unit_price * quantity;
    const discount_applied = volumePricing.discount_pct;
    const total_cost = (monthly_cost * months) + tier.setup_fee;
    const effective_rate = total_cost / months; // Amortized monthly rate including setup

    return {
      monthly_cost,
      total_cost,
      setup_fee: tier.setup_fee,
      discount_applied,
      effective_rate
    };
  }

  /**
   * Recommend optimal service tier based on requirements
   */
  recommendServiceTier(requirements: {
    budget_monthly?: number;
    budget_total?: number;
    commitment_months: number;
    required_sla?: string;
    user_count?: number;
    support_hours?: 'business' | 'extended' | '24x7';
    complexity?: 'low' | 'medium' | 'high' | 'enterprise';
  }): PricingRecommendation {
    const { commitment_months, budget_monthly, required_sla, support_hours, complexity } = requirements;

    // Score each tier based on requirements
    const scoredTiers = this.serviceTiers.map(tier => {
      const pricing = this.calculateTierPricing(tier.id, commitment_months);
      let score = 0;
      const reasoning: string[] = [];

      // Budget fit
      if (budget_monthly) {
        if (pricing.monthly_cost <= budget_monthly) {
          score += 30;
          reasoning.push(`Within monthly budget of $${budget_monthly.toLocaleString()}`);
        } else {
          score -= 20;
          reasoning.push(`Exceeds monthly budget by $${(pricing.monthly_cost - budget_monthly).toLocaleString()}`);
        }
      }

      // SLA requirements
      if (required_sla) {
        const tierSLA = parseFloat(tier.features.technical_specs.sla_uptime.replace('%', ''));
        const requiredSLA = parseFloat(required_sla.replace('%', ''));
        
        if (tierSLA >= requiredSLA) {
          score += 25;
          reasoning.push(`Meets SLA requirement of ${required_sla}`);
        } else {
          score -= 30;
          reasoning.push(`SLA of ${tier.features.technical_specs.sla_uptime} below requirement`);
        }
      }

      // Support hours alignment
      if (support_hours) {
        const tierSupport = tier.features.technical_specs.support_hours.toLowerCase();
        
        if (
          (support_hours === '24x7' && tierSupport.includes('24/7')) ||
          (support_hours === 'extended' && (tierSupport.includes('extended') || tierSupport.includes('24/7'))) ||
          (support_hours === 'business' && tierSupport.includes('business'))
        ) {
          score += 20;
          reasoning.push(`Support hours match requirement: ${support_hours}`);
        }
      }

      // Complexity alignment
      if (complexity) {
        const complexityScores = {
          'low': { 'ikusi-go': 25, 'ikusi-premium': 5 },
          'medium': { 'ikusi-premium': 25, 'ikusi-gold': 15, 'ikusi-go': 10 },
          'high': { 'ikusi-gold': 25, 'ikusi-platinum': 15, 'ikusi-premium': 5 },
          'enterprise': { 'ikusi-platinum': 25, 'ikusi-star': 30, 'ikusi-gold': 10 }
        };
        
        const complexityScore = complexityScores[complexity]?.[tier.id] || 0;
        score += complexityScore;
        
        if (complexityScore > 15) {
          reasoning.push(`Well-suited for ${complexity} complexity projects`);
        }
      }

      // Volume discount bonus
      if (pricing.discount_applied > 0) {
        score += pricing.discount_applied / 2;
        reasoning.push(`${pricing.discount_applied}% volume discount applied`);
      }

      return {
        tier,
        pricing,
        score,
        reasoning
      };
    });

    // Sort by score and select recommendation
    scoredTiers.sort((a, b) => b.score - a.score);
    const recommended = scoredTiers[0];

    // Calculate potential savings vs higher tiers
    const higherTierCosts = scoredTiers
      .filter(t => t.pricing.monthly_cost > recommended.pricing.monthly_cost)
      .map(t => t.pricing.monthly_cost);
    
    const avgHigherCost = higherTierCosts.length > 0 
      ? higherTierCosts.reduce((sum, cost) => sum + cost, 0) / higherTierCosts.length 
      : recommended.pricing.monthly_cost;
    
    const total_savings = (avgHigherCost - recommended.pricing.monthly_cost) * commitment_months;

    // Generate alternative options
    const alternative_options = scoredTiers.slice(1, 4).map(alt => ({
      tier: alt.tier.name,
      monthly_cost: alt.pricing.monthly_cost,
      pros: alt.reasoning.filter(r => !r.includes('Exceeds') && !r.includes('below')),
      cons: alt.reasoning.filter(r => r.includes('Exceeds') || r.includes('below'))
    }));

    return {
      recommended_tier: recommended.tier.name,
      monthly_cost: recommended.pricing.monthly_cost,
      annual_cost: recommended.pricing.monthly_cost * 12,
      total_savings,
      volume_discount_applied: recommended.pricing.discount_applied,
      reasoning: recommended.reasoning,
      alternative_options
    };
  }

  /**
   * Generate service tier comparison matrix
   */
  generateComparisonMatrix(): Array<{
    tier: string;
    monthly_cost_range: string;
    sla: string;
    support: string;
    use_case: string;
    key_features: string[];
  }> {
    return this.serviceTiers.map(tier => {
      const lowPrice = tier.pricing_tiers[tier.pricing_tiers.length - 1].unit_price;
      const highPrice = tier.pricing_tiers[0].unit_price;
      
      const priceRange = lowPrice === highPrice 
        ? `$${lowPrice.toLocaleString()}`
        : `$${lowPrice.toLocaleString()} - $${highPrice.toLocaleString()}`;

      // Extract key use cases based on tier
      const useCaseMap: Record<string, string> = {
        'ikusi-go': 'Startups, small projects, proof-of-concepts',
        'ikusi-premium': 'Growing companies, established SMEs',
        'ikusi-gold': 'Mid-market enterprises, complex implementations',
        'ikusi-platinum': 'Large enterprises, mission-critical systems',
        'ikusi-star': 'Fortune 500, digital transformation initiatives'
      };

      const keyFeaturesMap: Record<string, string[]> = {
        'ikusi-go': ['Basic setup', 'Email support', 'Monthly health checks', '2 users'],
        'ikusi-premium': ['Proactive monitoring', 'Priority support', '10 users', 'Analytics'],
        'ikusi-gold': ['Dedicated team', 'Unlimited users', 'Custom reporting', 'Priority features'],
        'ikusi-platinum': ['White-glove service', 'Executive dashboards', '1h response', 'Unlimited resources'],
        'ikusi-star': ['C-level advisory', 'Transformation team', 'Innovation lab', '30min response']
      };

      return {
        tier: tier.name,
        monthly_cost_range: priceRange,
        sla: tier.features.technical_specs.sla_uptime,
        support: tier.features.technical_specs.support_hours,
        use_case: useCaseMap[tier.id] || 'Custom requirements',
        key_features: keyFeaturesMap[tier.id] || []
      };
    });
  }

  /**
   * Calculate ROI for upgrading between tiers
   */
  calculateUpgradeROI(fromTier: string, toTier: string, months: number): {
    additional_cost: number;
    sla_improvement: string;
    features_gained: string[];
    estimated_roi_months: number;
    recommendation: 'upgrade' | 'stay' | 'consider';
  } {
    const fromPricing = this.calculateTierPricing(fromTier, months);
    const toPricing = this.calculateTierPricing(toTier, months);
    const additional_cost = toPricing.monthly_cost - fromPricing.monthly_cost;

    const fromTierObj = this.serviceTiers.find(t => t.id === fromTier);
    const toTierObj = this.serviceTiers.find(t => t.id === toTier);

    if (!fromTierObj || !toTierObj) {
      throw new Error('Invalid tier comparison');
    }

    const fromSLA = parseFloat(fromTierObj.features.technical_specs.sla_uptime.replace('%', ''));
    const toSLA = parseFloat(toTierObj.features.technical_specs.sla_uptime.replace('%', ''));
    const sla_improvement = `${fromSLA}% → ${toSLA}% (+${(toSLA - fromSLA).toFixed(1)}%)`;

    // Estimate ROI based on downtime cost savings and productivity gains
    const downtime_cost_per_hour = 5000; // Estimate
    const monthly_hours = 730; // Average hours per month
    const downtime_reduction = (toSLA - fromSLA) / 100 * monthly_hours;
    const monthly_savings = downtime_reduction * downtime_cost_per_hour;
    const estimated_roi_months = additional_cost > 0 ? additional_cost / monthly_savings : 0;

    let recommendation: 'upgrade' | 'stay' | 'consider' = 'stay';
    if (estimated_roi_months < 6) {
      recommendation = 'upgrade';
    } else if (estimated_roi_months < 12) {
      recommendation = 'consider';
    }

    // Simplified feature comparison
    const features_gained = [
      'Enhanced SLA and response times',
      'Improved support coverage',
      'Additional monitoring and reporting',
      'Higher resource limits'
    ];

    return {
      additional_cost,
      sla_improvement,
      features_gained,
      estimated_roi_months,
      recommendation
    };
  }
}

/**
 * Utility function to create LineItem from service tier selection
 */
export function createServiceLineItem(
  tierId: string, 
  serviceCatalog: any, 
  options: {
    quantity?: number;
    months?: number;
    cost_center?: string;
    gl_code?: string;
  } = {}
): Partial<LineItem> {
  const tier = serviceCatalog.service_tiers.find((t: ServiceTier) => t.id === tierId);
  if (!tier) {
    throw new Error(`Service tier ${tierId} not found`);
  }

  const calculator = new IkusiPricingCalculator(serviceCatalog);
  const pricing = calculator.calculateTierPricing(tierId, options.months || 12, options.quantity || 1);

  return {
    category: "Support",
    subtype: tier.tier,
    vendor: "Ikusi Technologies",
    description: tier.name,
    one_time: false,
    recurring: true,
    qty: options.quantity || 1,
    unit_cost: pricing.monthly_cost,
    currency: "USD",
    start_month: 1,
    end_month: options.months || 12,
    amortization: "none",
    capex_flag: false,
    cost_center: options.cost_center || "IT-SERVICES",
    gl_code: options.gl_code || "6000-001",
    service_tier: tierId,
    sla_uptime: tier.features.technical_specs.sla_uptime,
    support_model: tier.features.technical_specs.support_hours
  };
}