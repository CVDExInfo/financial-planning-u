/**
 * Unit tests for baseline creation with taxonomy mapping
 * 
 * Tests that baseline.ts properly applies taxonomy mapping to estimates
 * during creation, ensuring canonical rubroIds are assigned before storage.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { createBaseline } from "../../src/handlers/baseline";
import * as dynamo from "../../src/lib/dynamo";
import * as auth from "../../src/lib/auth";
import * as queue from "../../src/lib/queue";
import * as seedLineItems from "../../src/lib/seed-line-items";

// Mock dependencies
jest.mock("../../src/lib/auth");
jest.mock("../../src/lib/dynamo", () => ({
  ddb: {
    send: jest.fn(),
  },
  sendDdb: jest.fn(),
  tableName: jest.fn((table: string) => `test_${table}`),
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
  ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock("../../src/lib/queue");
jest.mock("../../src/lib/seed-line-items");

describe("Baseline Creation with Taxonomy Mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth to allow write access
    (auth.ensureCanWrite as jest.Mock).mockResolvedValue(undefined);
    (auth.getUserEmail as jest.Mock).mockResolvedValue("test@example.com");
    
    // Mock DynamoDB to succeed
    (dynamo.ddb.send as jest.Mock).mockResolvedValue({});
    (queue.enqueueMaterialization as jest.Mock).mockResolvedValue(undefined);
    (dynamo.sendDdb as jest.Mock).mockResolvedValue({});
    (seedLineItems.seedLineItemsFromBaseline as jest.Mock).mockResolvedValue({ seeded: 0, skipped: true });
  });

  it("should apply taxonomy mapping to labor estimates during baseline creation", async () => {
    const baselineRequest = {
      headers: {
        "Content-Type": "application/json",
      },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      httpMethod: "POST",
      path: "/baseline",
      body: JSON.stringify({
        project_name: "Test Project with Taxonomy Mapping",
        client_name: "Test Client",
        currency: "USD",
        start_date: "2024-01-01",
        duration_months: 12,
        labor_estimates: [
          {
            role: "Project Manager",
            level: "Senior",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 100,
            on_cost_percentage: 20,
            start_month: 1,
            end_month: 12,
          },
          {
            role: "Ingeniero Delivery",
            level: "Senior",
            hours_per_month: 160,
            fte_count: 2,
            hourly_rate: 80,
            on_cost_percentage: 20,
            start_month: 1,
            end_month: 12,
          },
          {
            role: "Ingeniero Soporte N1",
            level: "Junior",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 50,
            on_cost_percentage: 20,
            start_month: 1,
            end_month: 12,
          },
        ],
        non_labor_estimates: [
          {
            category: "Cloud Services",
            description: "AWS Infrastructure",
            amount: 5000,
            one_time: false,
            start_month: 1,
            end_month: 12,
          },
          {
            category: "Training",
            description: "Team certification program",
            amount: 10000,
            one_time: true,
            start_month: 6,
          },
        ],
      }),
    };

    const response = await createBaseline(baselineRequest as any);

    expect(response.statusCode).toBe(201);
    
    // Verify DynamoDB was called twice (once for project-scoped record, once for METADATA)
    expect(dynamo.ddb.send).toHaveBeenCalledTimes(2);
    
    // Get the calls to verify the stored data
    const calls = (dynamo.ddb.send as jest.Mock).mock.calls;
    
    // First call should be the project-scoped record
    // calls[0][0] is the PutCommand object
    const projectScopedCommand = calls[0][0];
    const projectScopedItem = projectScopedCommand.input?.Item || projectScopedCommand.Item;
    
    expect(projectScopedItem).toBeDefined();
    
    // Verify labor estimates have canonical rubroIds
    expect(projectScopedItem.labor_estimates).toBeDefined();
    expect(projectScopedItem.labor_estimates.length).toBe(3);
    
    // Project Manager → MOD-PM
    expect(projectScopedItem.labor_estimates[0].rubroId).toBe("MOD-PM");
    expect(projectScopedItem.labor_estimates[0].role).toBe("Project Manager");
    
    // Ingeniero Delivery → MOD-LEAD
    expect(projectScopedItem.labor_estimates[1].rubroId).toBe("MOD-LEAD");
    expect(projectScopedItem.labor_estimates[1].role).toBe("Ingeniero Delivery");
    
    // Ingeniero Soporte N1 → MOD-ING
    expect(projectScopedItem.labor_estimates[2].rubroId).toBe("MOD-ING");
    expect(projectScopedItem.labor_estimates[2].role).toBe("Ingeniero Soporte N1");
    
    // Verify non-labor estimates have canonical rubroIds
    expect(projectScopedItem.non_labor_estimates).toBeDefined();
    expect(projectScopedItem.non_labor_estimates.length).toBe(2);
    
    // AWS Infrastructure → INF-CLOUD (mapped from description)
    expect(projectScopedItem.non_labor_estimates[0].rubroId).toBe("INF-CLOUD");
    
    // Training → GSV-TRN (mapped from category)
    expect(projectScopedItem.non_labor_estimates[1].rubroId).toBe("GSV-TRN");
    
    // Second call should be the METADATA record
    const metadataCommand = calls[1][0];
    const metadataItem = metadataCommand.input?.Item || metadataCommand.Item;
    
    expect(metadataItem).toBeDefined();
    
    // Verify payload in METADATA also has the mapped estimates
    expect(metadataItem.payload).toBeDefined();
    expect(metadataItem.payload.labor_estimates).toBeDefined();
    expect(metadataItem.payload.labor_estimates.length).toBe(3);
    expect(metadataItem.payload.labor_estimates[0].rubroId).toBe("MOD-PM");
    expect(metadataItem.payload.labor_estimates[1].rubroId).toBe("MOD-LEAD");
    expect(metadataItem.payload.labor_estimates[2].rubroId).toBe("MOD-ING");
    
    expect(metadataItem.payload.non_labor_estimates).toBeDefined();
    expect(metadataItem.payload.non_labor_estimates.length).toBe(2);
    expect(metadataItem.payload.non_labor_estimates[0].rubroId).toBe("INF-CLOUD");
    expect(metadataItem.payload.non_labor_estimates[1].rubroId).toBe("GSV-TRN");
  });

  it("should use DEFAULT_LABOR_RUBRO for unknown labor roles", async () => {
    const baselineRequest = {
      headers: {
        "Content-Type": "application/json",
      },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      httpMethod: "POST",
      path: "/baseline",
      body: JSON.stringify({
        project_name: "Test Project with Unknown Role",
        labor_estimates: [
          {
            role: "Unknown Role Type",
            level: "Senior",
            hours_per_month: 160,
            fte_count: 1,
            hourly_rate: 100,
            on_cost_percentage: 20,
            start_month: 1,
            end_month: 12,
          },
        ],
        non_labor_estimates: [],
      }),
    };

    const response = await createBaseline(baselineRequest as any);

    expect(response.statusCode).toBe(201);
    
    const calls = (dynamo.ddb.send as jest.Mock).mock.calls;
    const projectScopedCommand = calls[0][0];
    const projectScopedItem = projectScopedCommand.input?.Item || projectScopedCommand.Item;
    
    // Should fallback to DEFAULT_LABOR_RUBRO (MOD-ING)
    expect(projectScopedItem.labor_estimates[0].rubroId).toBe("MOD-ING");
  });

  it("should use DEFAULT_NON_LABOR_RUBRO for unknown non-labor categories", async () => {
    const baselineRequest = {
      headers: {
        "Content-Type": "application/json",
      },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      httpMethod: "POST",
      path: "/baseline",
      body: JSON.stringify({
        project_name: "Test Project with Unknown Category",
        labor_estimates: [],
        non_labor_estimates: [
          {
            category: "Unknown Category",
            description: "Some unknown expense",
            amount: 5000,
            one_time: false,
            start_month: 1,
            end_month: 12,
          },
        ],
      }),
    };

    const response = await createBaseline(baselineRequest as any);

    expect(response.statusCode).toBe(201);
    
    const calls = (dynamo.ddb.send as jest.Mock).mock.calls;
    const projectScopedCommand = calls[0][0];
    const projectScopedItem = projectScopedCommand.input?.Item || projectScopedCommand.Item;
    
    // Should fallback to DEFAULT_NON_LABOR_RUBRO (GSV-REU)
    expect(projectScopedItem.non_labor_estimates[0].rubroId).toBe("GSV-REU");
  });

  it("should normalize camelCase fields from Estimator to snake_case with rubroIds", async () => {
    const baselineRequest = {
      headers: {
        "Content-Type": "application/json",
      },
      requestContext: {
        authorizer: { jwt: { claims: { email: "test@example.com" } } },
      },
      httpMethod: "POST",
      path: "/baseline",
      body: JSON.stringify({
        project_name: "Test Project with camelCase",
        labor_estimates: [
          {
            role: "Service Delivery Manager",
            level: "Senior",
            hoursPerMonth: 160,  // camelCase
            fteCount: 1,         // camelCase
            hourlyRate: 120,     // camelCase
            onCostPercentage: 20, // camelCase
            startMonth: 1,       // camelCase
            endMonth: 12,        // camelCase
          },
        ],
        non_labor_estimates: [
          {
            category: "Security",
            description: "SOC monitoring service",
            amount: 3000,
            oneTime: false,      // camelCase
            startMonth: 1,       // camelCase
            endMonth: 12,        // camelCase
          },
        ],
      }),
    };

    const response = await createBaseline(baselineRequest as any);

    expect(response.statusCode).toBe(201);
    
    const calls = (dynamo.ddb.send as jest.Mock).mock.calls;
    const projectScopedCommand = calls[0][0];
    const projectScopedItem = projectScopedCommand.input?.Item || projectScopedCommand.Item;
    
    // Verify labor estimate is normalized with canonical rubroId
    const laborEst = projectScopedItem.labor_estimates[0];
    expect(laborEst.rubroId).toBe("MOD-SDM");  // Service Delivery Manager → MOD-SDM
    expect(laborEst.role).toBe("Service Delivery Manager");
    expect(laborEst.hours_per_month).toBe(160);  // snake_case
    expect(laborEst.fte_count).toBe(1);          // snake_case
    expect(laborEst.hourly_rate).toBe(120);      // snake_case
    expect(laborEst.on_cost_percentage).toBe(20); // snake_case
    expect(laborEst.start_month).toBe(1);        // snake_case
    expect(laborEst.end_month).toBe(12);         // snake_case
    
    // Verify non-labor estimate is normalized with canonical rubroId
    const nonLaborEst = projectScopedItem.non_labor_estimates[0];
    expect(nonLaborEst.rubroId).toBe("SEC-SOC");  // Security/SOC → SEC-SOC
    expect(nonLaborEst.one_time).toBe(false);    // snake_case
    expect(nonLaborEst.start_month).toBe(1);     // snake_case
    expect(nonLaborEst.end_month).toBe(12);      // snake_case
  });
});
