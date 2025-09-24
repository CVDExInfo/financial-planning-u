# Financial Planning & Management UI

A comprehensive enterprise financial planning and management platform built with React, featuring PMO budget estimation and SDMT cost forecasting capabilities.

## 🚀 Live Demo

Access the live application: [Coming Soon - Will be deployed automatically]

## ✨ Features

### PMO Pre-Factura Estimator
- **Multi-step Wizard**: Deal inputs → Labor costs → Non-labor costs → FX/Indexation → Digital signature
- **Professional Exports**: Designed Excel templates with charts, formulas, and pivots
- **Baseline Creation**: Generates signed budget baselines with cryptographic signatures

### SDMT Cost Management
- **Dynamic Forecast Grid**: 60-month virtualized grid with real-time variance calculations  
- **Smart Reconciliation**: Invoice upload and automated matching with dispute resolution
- **Cash Flow Analysis**: Interactive charts showing inflows vs outflows with margin analysis
- **Scenario Planning**: Compare multiple budget scenarios with waterfall variance views
- **Change Management**: Approval workflows for budget modifications with full audit trail

## 🎨 Design System

Built with **Ikusi Visual Identity** featuring:
- **Sophisticated Interface**: Enterprise-grade design that instills confidence in financial decisions  
- **Smart Color System**: Module-specific accents (PMO green, SDMT teal) with accessibility compliance
- **Professional Typography**: Inter font family optimized for data-dense financial interfaces
- **Glass Morphism**: Subtle transparency effects with backdrop blur for modern aesthetics
- **Motion Design**: Purposeful animations that enhance data relationships without distraction

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4 + shadcn/ui components  
- **Charts**: Recharts with D3 integration
- **Data**: React Query + Virtualized grids for performance
- **Excel**: ExcelJS for designed template generation
- **Navigation**: React Router with deep linking support
- **Forms**: React Hook Form + Zod validation

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/financial-planning-management-ui.git
cd financial-planning-management-ui

# Install dependencies  
npm install

# Start development server
npm run dev
```

### Demo Script
1. **PMO Flow**: Navigate to `/pmo/prefactura/estimator` → Complete wizard → Export baseline
2. **SDMT Setup**: Go to `/sdmt/cost/catalog` → Add line items → Upload attachments  
3. **Forecasting**: Visit `/sdmt/cost/forecast` → Select project → Edit forecasts → Export designed Excel
4. **Reconciliation**: Upload invoices at `/sdmt/cost/recon` → Match against planned costs → Generate variance reports
5. **Analysis**: View cash flow insights at `/sdmt/cost/cashflow` → Drill down to forecast details

## 📊 Mock Data

The application includes realistic sample data:
- **baseline.json**: Multi-category project budget with labor/non-labor splits
- **forecast.json**: 60-month planned vs actual tracking across multiple line items  
- **invoices.json**: Sample vendor invoices in various approval states
- **billing-plan.json**: Expected project inflows for cash flow modeling

## 🔧 Available Scripts

```bash
npm run dev       # Development server with hot reload
npm run build     # Production build with TypeScript checking  
npm run preview   # Preview production build locally
npm run lint      # ESLint with TypeScript support
npm run typecheck # Standalone TypeScript validation
```

## 🏗️ Architecture

```
src/
├── app/           # Route configuration & providers
├── components/    # Shared UI components
├── features/      # Feature-specific modules
│   ├── pmo/       # PMO estimator wizard
│   └── sdmt/      # SDMT cost management
├── lib/           # Utilities & API clients  
├── mocks/         # Sample data for development
├── styles/        # Design tokens & global styles
└── types/         # TypeScript definitions
```

## 🎯 Quality Gates

- **Accessibility**: WCAG 2.2 AA compliance with enhanced focus states
- **Performance**: Route-based code splitting, virtualized grids, sub-2s TTFR
- **Type Safety**: Full TypeScript coverage with Zod schema validation  
- **Testing**: Component tests with React Testing Library
- **Code Quality**: ESLint + Prettier with strict configurations

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

This is an enterprise application. Please follow the established patterns for consistency:
- Use shadcn/ui components over custom implementations
- Follow the existing color token system  
- Add TypeScript types for all new data structures
- Include accessibility considerations for all interactive elements
- Test exports with real Excel/PDF viewers before committing