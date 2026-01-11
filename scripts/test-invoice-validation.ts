// Manual validation test script
// Run with: node --loader ts-node/esm scripts/test-invoice-validation.ts

import { validateInvoicePayload, formatValidationErrors } from '../src/utils/invoiceValidation.js';

console.log('Testing Invoice Validation Utility\n');

// Test 1: Valid payload
console.log('Test 1: Valid payload');
const validPayload = {
  line_item_id: 'R-12345',
  month_start: 1,
  month_end: 1,
  amount: 1000,
  vendor: 'Test Vendor',
  invoice_date: '2025-01-15',
  file: new File(['test'], 'test.pdf', { type: 'application/pdf' })
};
const errors1 = validateInvoicePayload(validPayload);
console.log('Errors:', errors1.length === 0 ? 'None ✅' : errors1);
console.log('');

// Test 2: Missing line_item_id
console.log('Test 2: Missing line_item_id');
const invalidPayload1 = { ...validPayload, line_item_id: '' };
const errors2 = validateInvoicePayload(invalidPayload1);
console.log('Errors:', formatValidationErrors(errors2));
console.log('');

// Test 3: Invalid month range
console.log('Test 3: Invalid month range (start > end)');
const invalidPayload2 = { ...validPayload, month_start: 5, month_end: 3 };
const errors3 = validateInvoicePayload(invalidPayload2);
console.log('Errors:', formatValidationErrors(errors3));
console.log('');

// Test 4: Invalid amount
console.log('Test 4: Invalid amount (negative)');
const invalidPayload3 = { ...validPayload, amount: -100 };
const errors4 = validateInvoicePayload(invalidPayload3);
console.log('Errors:', formatValidationErrors(errors4));
console.log('');

// Test 5: Missing vendor
console.log('Test 5: Missing vendor');
const invalidPayload4 = { ...validPayload, vendor: '' };
const errors5 = validateInvoicePayload(invalidPayload4);
console.log('Errors:', formatValidationErrors(errors5));
console.log('');

// Test 6: Invalid date
console.log('Test 6: Invalid date');
const invalidPayload5 = { ...validPayload, invoice_date: 'not-a-date' };
const errors6 = validateInvoicePayload(invalidPayload5);
console.log('Errors:', formatValidationErrors(errors6));
console.log('');

// Test 7: Missing file
console.log('Test 7: Missing file');
const invalidPayload6 = { ...validPayload, file: null };
const errors7 = validateInvoicePayload(invalidPayload6);
console.log('Errors:', formatValidationErrors(errors7));
console.log('');

// Test 8: Multiple errors
console.log('Test 8: Multiple errors');
const invalidPayload7 = {
  line_item_id: '',
  month_start: 0,
  month_end: 13,
  amount: -100,
  vendor: '',
  invoice_date: 'invalid',
  file: null
};
const errors8 = validateInvoicePayload(invalidPayload7);
console.log('Errors:', formatValidationErrors(errors8));
console.log('Total error count:', errors8.length);

console.log('\n✅ Manual validation tests complete!');
