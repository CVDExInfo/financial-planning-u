# Financial Planning & Management Platform

Enterprise PMO Platform for comprehensive project cost estimation, forecasting, and financial management across PMO and SDMT workflows.

## 🌟 Demo Projects

The platform comes with three realistic demo projects showcasing different industries and complexities:

### 1. Healthcare System Modernization
- **Project ID**: PRJ-HEALTHCARE-MODERNIZATION
- **Baseline**: BL-2024-001
- **Focus**: HIPAA-compliant digital transformation for national healthcare provider
- **Key Features**: EHR systems, healthcare compliance, security testing
- **Budget**: $485,000 over 12 months

### 2. Banking Core Platform Upgrade
- **Project ID**: PRJ-FINTECH-PLATFORM
- **Baseline**: BL-2024-002
- **Focus**: Next-generation banking platform with real-time processing
- **Key Features**: High-availability infrastructure, banking security, Oracle database
- **Budget**: $750,000 over 18 months

### 3. Retail Intelligence & Analytics Suite
- **Project ID**: PRJ-RETAIL-ANALYTICS
- **Baseline**: BL-2024-003
- **Focus**: AI-powered analytics platform for retail optimization
- **Key Features**: Data science, Azure ML services, Tableau analytics
- **Budget**: $425,000 over 12 months

## 🚀 Features

### PMO Module
- **Pre-Factura Estimator**: Wizard-driven baseline budget creation
- Deal inputs, labor estimation, non-labor costs, FX/indexation
- Digital signature and baseline handoff

### SDMT Module
- **Cost Catalog**: Line item management with attachments
- **Forecast Management**: 60-month grid with inline editing
- **Reconciliation**: Invoice uploads and matching
- **Cash Flow & Margin**: Financial analytics with drill-down
- **Scenarios**: Budget scenario modeling
- **Change Management**: Budget change requests and approvals

## 🔧 Development

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
npm run preview
```

### Testing
```bash
npm run lint
npm run typecheck
```

## 🎯 Role-Based Access

- **PMO**: Access to estimator wizard and budget creation
- **SDMT**: Access to all cost management features
- **VENDOR**: Limited access to relevant cost data
- **EXEC_RO**: Read-only executive dashboard access

## 📊 Technology Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React Query + Zustand for complex state
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts with custom themes
- **Excel**: ExcelJS for designed exports
- **Mock Data**: JSON-based with realistic business scenarios

## 🎨 Design System

- **Colors**: Ikusi-inspired green palette with module-specific accents
- **Typography**: Inter font family for professional appearance
- **Components**: Consistent shadcn/ui component library
- **Themes**: Light/dark mode support with smooth transitions

## 📝 License

MIT License - Copyright (c) 2024 Enterprise PMO Platform