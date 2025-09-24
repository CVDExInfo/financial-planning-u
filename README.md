# Financial Planning & Management UI

A comprehensive financial planning and management platform for project cost estimation, forecasting, and financial analysis across PMO and SDMT workflows.

## 🚀 Live Application

**[View Live Application](https://your-deployment-url-here.com)** *(URL will be updated after deployment)*

## 📋 Overview

This application provides two main modules:

### PMO Pre-Factura Estimator
- **Deal Inputs**: Project scoping and timeline definition
- **Labor Costs**: Team composition with role-based rate presets
- **Non-Labor Costs**: Infrastructure, licenses, and services
- **FX & Indexation**: Currency handling and inflation adjustments
- **Review & Sign**: Digital signature and baseline creation

### SDMT Cost Management Suite
- **Cost Catalog**: Line item management with CRUD operations
- **Forecast Management**: 60-month virtualized grid with variance tracking
- **Reconciliation**: Invoice upload and matching workflow
- **Cash Flow Analysis**: Inflows vs outflows with margin tracking
- **Scenario Planning**: What-if modeling and comparison
- **Change Management**: Budget change requests and approval workflow

## 🛠 Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form + Zod validation
- **State**: React state + useKV for persistence
- **Routing**: React Router v6
- **Icons**: Lucide React + Phosphor Icons

## 🏗 Architecture

### Project Structure
```
src/
├── app/                    # App-level routing and providers
├── components/             # Shared UI components
│   ├── ui/                # shadcn/ui components (pre-installed)
│   ├── charts/            # Chart components (DonutChart, LineChart, etc.)
│   └── ...               # Navigation, ProjectContextBar, etc.
├── features/              # Feature-based modules
│   ├── pmo/              # PMO Estimator wizard
│   └── sdmt/             # SDMT Cost Management suite
├── lib/                  # Utilities and services
│   ├── api.ts           # Mock API service
│   └── utils.ts         # Shared utilities
├── mocks/               # Mock data (JSON files)
├── types/               # TypeScript domain types
└── styles/              # Global styles and tokens
```

### Key Design Patterns
- **Feature-based organization**: Each module is self-contained
- **Component composition**: Reusable UI components with consistent props
- **Type-safe API layer**: Full TypeScript coverage with Zod validation
- **Persistent state**: Critical user data saved with useKV hook
- **Mock-first development**: Complete mock API for demo and development

## 🎨 Design System

### Visual Identity
- **Primary Color**: Ikusi Green (`oklch(0.61 0.15 160)`)
- **Module Colors**: PMO Green, SDMT Teal for differentiation
- **Typography**: Inter font family with mathematical scale
- **Visual Vitality**: Soft mint backgrounds, glass morphism effects

### Accessibility
- **WCAG 2.2 AA compliance**: All text meets contrast requirements
- **Keyboard navigation**: Full keyboard accessibility
- **Screen readers**: Proper ARIA labels and semantic markup
- **Focus management**: Enhanced focus rings for interaction clarity

## 🔧 Local Development

### Prerequisites
- Node.js 18+ and npm/yarn
- Modern browser with ES2020 support

### Setup
```bash
# Clone and install dependencies
git clone <repository-url>
cd financial-planning-and-management-ui
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

## 🎯 Key Features

### PMO Estimator Wizard
1. **Step-by-Step Process**: Guided workflow with progress tracking
2. **Rate Presets**: Country/role-based labor rate suggestions
3. **Cost Categories**: Comprehensive labor and non-labor categorization
4. **FX Handling**: Multi-currency support with hedging strategies
5. **Digital Signature**: Baseline creation with audit trail
6. **Export Capabilities**: JSON, PDF, and Excel export options

### SDMT Cost Management
1. **Project Context**: Persistent project selection across all views
2. **Forecast Grid**: Virtualized 60-month planning interface
3. **Variance Tracking**: Planned vs Forecast vs Actual comparison
4. **Import/Export**: CSV/Excel import with mapping wizard
5. **Visual Analytics**: Interactive charts with drill-down capabilities
6. **Role-based Access**: Different views for PMO, SDMT, Vendor, Executive

### Data Visualization
1. **Interactive Charts**: Donut, line, stacked column charts
2. **Trend Analysis**: Time-series data with variance highlighting
3. **Export Options**: PNG/PDF chart export functionality
4. **Responsive Design**: Charts adapt to different screen sizes
5. **Color Consistency**: Brand-aligned color palette throughout

## 📊 Data Models

### Core Domain Types
- **LineItem**: Individual cost components with categorization
- **BaselineBudget**: PMO-created estimate with signature
- **ForecastCell**: Monthly planned/forecast/actual values
- **InvoiceDoc**: Evidence documents for reconciliation
- **Scenario**: What-if modeling with delta calculations

### API Layer
- **Mock Implementation**: Complete API simulation for demo
- **Type Safety**: Zod validation for all data operations
- **Real API Ready**: Easy switch to actual backend services
- **Error Handling**: Comprehensive error states and recovery

## 🔐 Security & Compliance

### Data Protection
- **No sensitive data logging**: Client-side security measures
- **Secure state management**: Encrypted local storage where applicable
- **Input validation**: All user inputs validated client and server-side

### Audit Trail
- **Change tracking**: All modifications logged with timestamps
- **User attribution**: Actions tied to authenticated users
- **Signature verification**: Digital signature validation
- **Immutable records**: Historical data preservation

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Build optimization enabled
- [ ] CDN assets configured
- [ ] Analytics tracking enabled
- [ ] Error monitoring setup
- [ ] Performance monitoring active

### Build Configuration
```bash
# Production build with optimizations
npm run build

# Analyze bundle size
npm run build -- --analyze

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## 📈 Performance

### Optimization Features
- **Code Splitting**: Route-based lazy loading
- **Virtual Scrolling**: Large dataset handling
- **Image Optimization**: Responsive images with lazy loading
- **Bundle Analysis**: Webpack bundle optimization
- **Caching Strategy**: Efficient asset caching

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Lighthouse Score**: > 90 across all metrics

## 🤝 Contributing

### Development Guidelines
1. **Component Creation**: Use shadcn/ui as base, extend with custom logic
2. **Type Safety**: All components must have proper TypeScript interfaces
3. **Testing**: Unit tests for business logic, integration tests for workflows
4. **Accessibility**: All interactive elements must be keyboard accessible
5. **Documentation**: Comment complex business logic and calculations

### Code Style
- **ESLint**: Configured with React and TypeScript rules
- **Prettier**: Automatic code formatting
- **Import Order**: Organized imports with absolute paths
- **Naming**: Descriptive names for components and functions

## 📝 License

MIT License - see LICENSE file for details.

## 📞 Support

For technical support or feature requests:
- **Email**: support@ikusi.com
- **Documentation**: [Internal Wiki](link-to-wiki)
- **Issue Tracker**: GitHub Issues

---

Built with ❤️ by the Ikusi Digital Platform Team