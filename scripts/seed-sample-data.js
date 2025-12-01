#!/usr/bin/env node
// Node script to seed sample data into Finanzas SD DynamoDB tables.
// Reads table names from CloudFormation stack outputs and inserts a project,
// rubros (line items), and a provider.  Requires AWS credentials via OIDC.

const {
  CloudFormationClient,
  DescribeStacksCommand
} = require("@aws-sdk/client-cloudformation");
const {
  DynamoDBClient,
  PutItemCommand
} = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

// Ensure required environment variables are set
function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

// Get a specific output value from the given CloudFormation stack
async function getOutput(stackName, outputKey, cfClient) {
  const data = await cfClient.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const stack = data.Stacks[0];
  const output = stack.Outputs.find((o) => o.OutputKey === outputKey);
  if (!output) {
    throw new Error(`Output key "${outputKey}" not found in stack ${stackName}`);
  }
  return output.OutputValue;
}

// Put an item into DynamoDB using AWS SDK v3
async function putItem(tableName, item, ddbClient) {
  const params = {
    TableName: tableName,
    Item: marshall(item),
  };
  await ddbClient.send(new PutItemCommand(params));
}

// Main function to seed data
async function main() {
  assertEnv("FINZ_API_STACK");
  assertEnv("AWS_REGION");

  const stackName = process.env.FINZ_API_STACK;
  const region = process.env.AWS_REGION;

  const cfClient = new CloudFormationClient({ region });
  const ddbClient = new DynamoDBClient({ region });

  // Retrieve table names from CloudFormation outputs
  const projectsTable = await getOutput(stackName, "ProjectsTableName", cfClient);
  const rubrosTable = await getOutput(stackName, "RubrosTableName", cfClient);
  const providersTable = await getOutput(stackName, "ProvidersTableName", cfClient);

  console.log(`Seeding sample data into ${projectsTable}, ${rubrosTable}, and ${providersTable}...`);

  // Sample project
  const projectId = "proj_seed_001";
  await putItem(projectsTable, {
    id: projectId,
    name: "Seed Project",
    description: "Temporary sample project for UI testing",
    status: "ACTIVE",
    createdAt: new Date().toISOString()
  }, ddbClient);

  // Sample rubros (line items) for the project
  await putItem(rubrosTable, {
    id: "rubro_seed_001",
    projectId,
    name: "Development Costs",
    budget: 50000,
    actual: 0,
    currency: "USD",
    createdAt: new Date().toISOString()
  }, ddbClient);

  await putItem(rubrosTable, {
    id: "rubro_seed_002",
    projectId,
    name: "QA & Testing",
    budget: 15000,
    actual: 0,
    currency: "USD",
    createdAt: new Date().toISOString()
  }, ddbClient);

  // Sample provider
  await putItem(providersTable, {
    id: "prov_seed_001",
    name: "Seed Provider Inc.",
    contactName: "Jane Doe",
    contactEmail: "jane.doe@example.com",
    status: "ACTIVE",
    createdAt: new Date().toISOString()
  }, ddbClient);

  console.log("Sample data seeding completed successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
