import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calculator, BarChart3, Users, TrendingUp } from 'lucide-react';

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">I</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Financial Planning & Management
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Ikusi Digital Platform
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Comprehensive solution for project cost estimation, forecasting, and financial management
            across PMO and SDMT workflows
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* PMO Module */}
          <Card className="glass-card hover:shadow-lg transition-all duration-300 border-primary/20">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Calculator className="text-primary" size={24} />
                </div>
                <Badge className="module-badge-pmo">PMO Module</Badge>
              </div>
              <div>
                <CardTitle className="text-2xl mb-2">Pre-Factura Estimator</CardTitle>
                <p className="text-muted-foreground">
                  Create comprehensive baseline budget estimates with labor, non-labor costs, 
                  FX handling, and digital signature for SDMT handoff
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Deal inputs and project scoping</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Labor cost estimation with role presets</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Non-labor costs and infrastructure planning</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>FX rates and indexation policies</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Digital signature and baseline creation</span>
                </div>
              </div>
              
              <Link to="/pmo/prefactura/estimator">
                <Button className="w-full gap-2" size="lg">
                  Launch PMO Estimator
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* SDMT Module */}
          <Card className="glass-card hover:shadow-lg transition-all duration-300 border-[oklch(0.58_0.15_180)]/20">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-[oklch(0.58_0.15_180)]/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="text-[oklch(0.58_0.15_180)]" size={24} />
                </div>
                <Badge className="module-badge-sdmt">SDMT Module</Badge>
              </div>
              <div>
                <CardTitle className="text-2xl mb-2">Cost Management Suite</CardTitle>
                <p className="text-muted-foreground">
                  Complete cost tracking, forecasting, reconciliation, and financial analysis 
                  tools for ongoing project management
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Cost Catalog</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Forecast Grid</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Reconciliation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Cash Flow Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Scenario Planning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[oklch(0.58_0.15_180)] rounded-full"></div>
                  <span>Change Management</span>
                </div>
              </div>
              
              <Link to="/sdmt/cost/catalog">
                <Button 
                  variant="outline" 
                  className="w-full gap-2 border-[oklch(0.58_0.15_180)]/50 hover:bg-[oklch(0.58_0.15_180)]/5" 
                  size="lg"
                >
                  Enter SDMT Suite
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="text-green-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Role-Based Access</h3>
            <p className="text-sm text-muted-foreground">
              PMO, SDMT, Vendor, and Executive access controls with appropriate feature visibility
            </p>
          </Card>

          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-Time Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Interactive charts, variance analysis, and financial insights with export capabilities
            </p>
          </Card>

          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="text-purple-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Advanced Forecasting</h3>
            <p className="text-sm text-muted-foreground">
              60-month forecasting grids with scenario modeling and change impact analysis
            </p>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8 border-t border-border">
          <p className="text-muted-foreground">
            Built with React, TypeScript, Tailwind CSS, and shadcn/ui
          </p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;