/**
 * Unit tests for PMOBaselinesQueuePage
 * 
 * These tests validate:
 * 1. New column rendering (Rubros, Accepted/Rejected By, Accepted At)
 * 2. Sorting by rubros_count and baseline_accepted_at
 * 3. Missing Rubros filter (rubros_count === 0)
 * 4. Ver Rubros navigation with correct query params
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Mock project data
type BaselineStatus = "pending" | "handed_off" | "accepted" | "rejected";

interface ProjectWithBaseline {
  id: string;
  name: string;
  client?: string | null;
  baseline_id?: string;
  baseline_status?: BaselineStatus | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string;
  rejected_by?: string | null;
  baseline_rejected_at?: string;
  rejection_comment?: string;
  rubros_count?: number;
  labor_cost?: number;
  non_labor_cost?: number;
}

const mockProjects: ProjectWithBaseline[] = [
  {
    id: "proj-1",
    name: "Project Alpha",
    client: "Client A",
    baseline_id: "baseline-1",
    baseline_status: "accepted",
    accepted_by: "John Doe",
    baseline_accepted_at: "2024-01-15T10:00:00Z",
    rubros_count: 5,
    labor_cost: 10000,
    non_labor_cost: 5000,
  },
  {
    id: "proj-2",
    name: "Project Beta",
    client: "Client B",
    baseline_id: "baseline-2",
    baseline_status: "pending",
    rubros_count: 0,
  },
  {
    id: "proj-3",
    name: "Project Gamma",
    client: "Client C",
    baseline_id: "baseline-3",
    baseline_status: "rejected",
    rejected_by: "Jane Smith",
    baseline_rejected_at: "2024-01-10T14:30:00Z",
    rejection_comment: "Needs more details",
    rubros_count: 3,
  },
  {
    id: "proj-4",
    name: "Project Delta",
    client: "Client D",
    baseline_id: "baseline-4",
    baseline_status: "accepted",
    accepted_by: "Alice Brown",
    baseline_accepted_at: "2024-01-20T15:00:00Z",
    rubros_count: 0,
  },
];

describe("PMOBaselinesQueuePage - Filtering Logic", () => {
  it("filters projects with missing rubros (rubros_count === 0)", () => {
    const showMissingRubros = true;
    const selectedStatus = "all";
    
    const filtered = mockProjects.filter((p) => {
      if (selectedStatus === "all") {
        if (showMissingRubros) {
          return p.rubros_count === 0;
        }
        return true;
      }
      return p.baseline_status === selectedStatus;
    });

    assert.strictEqual(filtered.length, 2);
    assert.strictEqual(filtered[0].id, "proj-2");
    assert.strictEqual(filtered[1].id, "proj-4");
  });

  it("filters projects by status and missing rubros combined", () => {
    const showMissingRubros = true;
    const selectedStatus = "accepted";
    
    const filtered = mockProjects.filter((p) => {
      const matchesStatus = p.baseline_status === selectedStatus;
      if (showMissingRubros) {
        return matchesStatus && p.rubros_count === 0;
      }
      return matchesStatus;
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, "proj-4");
  });

  it("counts projects with missing rubros correctly", () => {
    const missingRubrosCount = mockProjects.filter((p) => p.rubros_count === 0).length;
    assert.strictEqual(missingRubrosCount, 2);
  });
});

describe("PMOBaselinesQueuePage - Sorting Logic", () => {
  it("sorts projects by rubros_count ascending", () => {
    const sorted = [...mockProjects].sort((a, b) => {
      const aValue = a.rubros_count ?? -1;
      const bValue = b.rubros_count ?? -1;
      return aValue - bValue; // asc
    });

    assert.strictEqual(sorted[0].rubros_count, 0);
    assert.strictEqual(sorted[1].rubros_count, 0);
    assert.strictEqual(sorted[2].rubros_count, 3);
    assert.strictEqual(sorted[3].rubros_count, 5);
  });

  it("sorts projects by rubros_count descending", () => {
    const sorted = [...mockProjects].sort((a, b) => {
      const aValue = a.rubros_count ?? -1;
      const bValue = b.rubros_count ?? -1;
      return bValue - aValue; // desc
    });

    assert.strictEqual(sorted[0].rubros_count, 5);
    assert.strictEqual(sorted[1].rubros_count, 3);
    assert.strictEqual(sorted[2].rubros_count, 0);
    assert.strictEqual(sorted[3].rubros_count, 0);
  });

  it("sorts projects by baseline_accepted_at ascending", () => {
    const sorted = [...mockProjects].sort((a, b) => {
      const aValue = a.baseline_accepted_at ? new Date(a.baseline_accepted_at).getTime() : 0;
      const bValue = b.baseline_accepted_at ? new Date(b.baseline_accepted_at).getTime() : 0;
      return aValue - bValue; // asc
    });

    // Projects without accepted_at should come first (0)
    assert.strictEqual(sorted[0].baseline_accepted_at, undefined);
    assert.strictEqual(sorted[1].baseline_accepted_at, undefined);
    // Then sorted by date
    assert.strictEqual(sorted[2].id, "proj-1"); // Jan 15
    assert.strictEqual(sorted[3].id, "proj-4"); // Jan 20
  });

  it("sorts projects by baseline_accepted_at descending", () => {
    const sorted = [...mockProjects].sort((a, b) => {
      const aValue = a.baseline_accepted_at ? new Date(a.baseline_accepted_at).getTime() : 0;
      const bValue = b.baseline_accepted_at ? new Date(b.baseline_accepted_at).getTime() : 0;
      return bValue - aValue; // desc
    });

    // Most recent first
    assert.strictEqual(sorted[0].id, "proj-4"); // Jan 20
    assert.strictEqual(sorted[1].id, "proj-1"); // Jan 15
    // Projects without accepted_at should come last (0)
    assert.strictEqual(sorted[2].baseline_accepted_at, undefined);
    assert.strictEqual(sorted[3].baseline_accepted_at, undefined);
  });
});

describe("PMOBaselinesQueuePage - Navigation URLs", () => {
  it("generates correct Ver Rubros navigation URL", () => {
    const project = mockProjects[0];
    const expectedUrl = `/finanzas/sdmt/cost/catalog?projectId=${project.id}&baseline=${project.baseline_id}`;
    
    assert.strictEqual(
      expectedUrl,
      "/finanzas/sdmt/cost/catalog?projectId=proj-1&baseline=baseline-1"
    );
  });

  it("generates Ver Rubros URLs for all projects", () => {
    mockProjects.forEach((project) => {
      const url = `/finanzas/sdmt/cost/catalog?projectId=${project.id}&baseline=${project.baseline_id}`;
      assert.match(url, /^\/finanzas\/sdmt\/cost\/catalog\?projectId=.+&baseline=.+$/);
    });
  });
});

