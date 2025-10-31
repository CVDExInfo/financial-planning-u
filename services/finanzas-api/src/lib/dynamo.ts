import AWS from 'aws-sdk';
export const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
const env = process.env;

export const tableName = (key: 'projects'|'rubros'|'allocations'|'payroll_actuals'|'adjustments'|'alerts'|'providers'|'audit_log') => {
  const envKey = `TABLE_${key.toUpperCase()}`;
  const name = env[envKey];
  if (!name) {
    throw new Error(`Environment variable ${envKey} is not defined`);
  }
  return name;
};
