#!/usr/bin/env node

/**
 * Sample Data Generator
 * 
 * Generates realistic mock data for the Financial Planning & Management UI.
 * This script can be used to refresh test data during development.
 */

const fs = require('fs');
const path = require('path');

// Sample project data
const projects = [
  { id: 'PRJ-IKUSI-PLATFORM', name: 'Ikusi Digital Platform', status: 'active' },
  { id: 'PRJ-CLIENT-PORTAL', name: 'Client Self-Service Portal', status: 'active' },
  { id: 'PRJ-DATA-MIGRATION', name: 'Legacy System Migration', status: 'planning' },
];

// Generate baseline data
function generateBaseline() {
  const lineItems = [
    {
      id: 'LI-001',
      category: 'Labor',
      subtype: 'Development',
      description: 'Senior React Developer',
      one_time: false,
      recurring: true,
      qty: 2,
      unit_cost: 8500,
      currency: 'USD',
      start_month: 1,
      end_month: 12,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none'
    },
    {
      id: 'LI-002', 
      category: 'Labor',
      subtype: 'Management',
      description: 'Project Manager',
      one_time: false,
      recurring: true,
      qty: 1,
      unit_cost: 9500,
      currency: 'USD',
      start_month: 1,
      end_month: 12,
      amortization: 'none',
      capex_flag: false,
      indexation_policy: 'none'
    },
    {
      id: 'LI-003',
      category: 'Non-Labor',
      subtype: 'Software',
      description: 'AWS Infrastructure',
      one_time: false,
      recurring: true,
      qty: 1,
      unit_cost: 2500,
      currency: 'USD', 
      start_month: 1,
      end_month: 12,
      amortization: 'none',
      capex_flag: true,
      indexation_policy: 'none'
    },
    {
      id: 'LI-004',
      category: 'Non-Labor',
      subtype: 'Hardware',
      description: 'Development Laptops',
      one_time: true,
      recurring: false,
      qty: 3,
      unit_cost: 2800,
      currency: 'USD',
      start_month: 1,
      end_month: 1,
      amortization: 'straight_line',
      capex_flag: true,
      indexation_policy: 'none'
    }
  ];

  const monthlyTotals = [];
  for (let month = 1; month <= 12; month++) {
    let total = 0;
    lineItems.forEach(item => {
      if (month >= item.start_month && month <= item.end_month) {
        total += item.qty * item.unit_cost;
      }
    });
    monthlyTotals.push({ month, amount_planned: total });
  }

  return {
    baseline_id: 'BSL-2024-001',
    project_id: 'PRJ-IKUSI-PLATFORM',
    created_by: 'maria.gonzalez@ikusi.com',
    accepted_by: 'carlos.rodriguez@client.com',
    accepted_ts: '2024-03-15T10:30:00Z',
    signature_hash: 'SHA256:a1b2c3d4e5f6789abcdef0123456789',
    line_items: lineItems,
    monthly_totals: monthlyTotals,
    assumptions: [
      'USD/COP exchange rate stable at 4000',
      'No indexation applied for Year 1',
      'AWS costs based on projected usage patterns'
    ]
  };
}

// Generate forecast data
function generateForecast() {
  const cells = [];
  const lineItemIds = ['LI-001', 'LI-002', 'LI-003', 'LI-004'];
  
  lineItemIds.forEach(lineItemId => {
    for (let month = 1; month <= 12; month++) {
      const planned = Math.floor(Math.random() * 20000) + 5000;
      const forecast = planned + (Math.random() - 0.5) * planned * 0.1; // ±10% variance
      const actual = month <= 6 ? forecast + (Math.random() - 0.5) * forecast * 0.05 : 0; // ±5% execution variance
      
      cells.push({
        line_item_id: lineItemId,
        month,
        planned,
        forecast: Math.round(forecast),
        actual: Math.round(actual),
        variance: Math.round(forecast - planned),
        variance_reason: Math.abs(forecast - planned) > planned * 0.05 ? 
          ['FX', 'indexation', 'vendor_delay', 'scope'][Math.floor(Math.random() * 4)] : undefined
      });
    }
  });

  return { forecast_cells: cells };
}

// Generate billing plan
function generateBillingPlan() {
  const monthlyInflows = [];
  
  for (let month = 1; month <= 12; month++) {
    // Simulate quarterly payments with some monthly services
    const baseAmount = 50000;
    const quarterlyBonus = [1, 4, 7, 10].includes(month) ? 25000 : 0;
    const monthlyServices = 8000;
    
    monthlyInflows.push({
      month,
      amount: baseAmount + quarterlyBonus + monthlyServices + (Math.random() * 5000),
      description: `Q${Math.ceil(month/3)} Payment${quarterlyBonus ? ' + Milestone' : ''}`
    });
  }

  return { monthly_inflows: monthlyInflows };
}

// Generate invoice data
function generateInvoices() {
  const invoices = [
    {
      id: 'INV-001',
      line_item_id: 'LI-001',
      month: 1,
      file_url: '/uploads/invoice-001.pdf',
      status: 'Matched',
      vendor: 'TechCorp Solutions',
      amount: 17000,
      uploaded_at: '2024-02-01T09:15:00Z'
    },
    {
      id: 'INV-002',
      line_item_id: 'LI-002', 
      month: 1,
      file_url: '/uploads/invoice-002.pdf',
      status: 'Pending',
      vendor: 'PM Services Inc',
      amount: 9500,
      uploaded_at: '2024-02-03T14:30:00Z'
    },
    {
      id: 'INV-003',
      line_item_id: 'LI-003',
      month: 1,
      file_url: '/uploads/invoice-003.pdf',
      status: 'Disputed',
      vendor: 'Amazon Web Services',
      amount: 2750,
      uploaded_at: '2024-02-05T11:45:00Z',
      comments: ['Amount higher than expected', 'Checking usage patterns']
    }
  ];

  return { invoices };
}

// Write files
const mocksDir = path.join(__dirname, '../src/mocks');

// Ensure directory exists
if (!fs.existsSync(mocksDir)) {
  fs.mkdirSync(mocksDir, { recursive: true });
}

// Generate and write files
fs.writeFileSync(
  path.join(mocksDir, 'baseline.json'),
  JSON.stringify(generateBaseline(), null, 2)
);

fs.writeFileSync(
  path.join(mocksDir, 'forecast.json'),
  JSON.stringify(generateForecast(), null, 2)
);

fs.writeFileSync(
  path.join(mocksDir, 'billing-plan.json'),
  JSON.stringify(generateBillingPlan(), null, 2)
);

fs.writeFileSync(
  path.join(mocksDir, 'invoices.json'),
  JSON.stringify(generateInvoices(), null, 2)
);

console.log('✅ Mock data generated successfully!');
console.log('📁 Files created:');
console.log('  - baseline.json');
console.log('  - forecast.json'); 
console.log('  - billing-plan.json');
console.log('  - invoices.json');