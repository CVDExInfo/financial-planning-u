/**
 * Tests for project label formatting utilities
 */

import { describe, it, expect } from "@jest/globals";
import {
  formatProjectLabel,
  formatProjectLabelWithClient,
  getProjectCode,
  getProjectName,
  type ProjectLike,
} from "../formatLabel";

describe("formatProjectLabel", () => {
  it("should format with id-and-name mode by default", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should show only code in id-only mode", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabel(project, "id-only");
    expect(result).toBe("PRJ-001");
  });

  it("should show only name in name-only mode", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabel(project, "name-only");
    expect(result).toBe("Mobile App");
  });

  it("should fallback to code when name is missing in name-only mode", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "",
    };

    const result = formatProjectLabel(project, "name-only");
    expect(result).toBe("PRJ-001");
  });

  it("should prefer code over id for display", () => {
    const project: ProjectLike = {
      id: "INTERNAL-UUID-123",
      code: "P-5ae50ace",
      name: "Project Alpha",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("P-5ae50ace – Project Alpha");
  });

  it("should use id when code is missing", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should handle missing name gracefully", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001");
  });

  it("should handle missing code gracefully", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should trim whitespace from code and name", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "  PRJ-001  ",
      name: "  Mobile App  ",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should handle empty strings as missing values", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "",
      name: "",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001");
  });

  it("should handle null values", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: null,
      name: null,
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("PRJ-001");
  });

  it("should return fallback when all fields are missing", () => {
    const project: ProjectLike = {
      id: "",
    };

    const result = formatProjectLabel(project);
    expect(result).toBe("Unknown Project");
  });
});

describe("formatProjectLabelWithClient", () => {
  it("should include client when includeClient is true", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
      client: "ACME Corp",
    };

    const result = formatProjectLabelWithClient(project, "id-and-name", true);
    expect(result).toBe("PRJ-001 – Mobile App (ACME Corp)");
  });

  it("should not include client when includeClient is false", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
      client: "ACME Corp",
    };

    const result = formatProjectLabelWithClient(project, "id-and-name", false);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should handle missing client gracefully", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
    };

    const result = formatProjectLabelWithClient(project, "id-and-name", true);
    expect(result).toBe("PRJ-001 – Mobile App");
  });

  it("should trim client whitespace", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      code: "PRJ-001",
      name: "Mobile App",
      client: "  ACME Corp  ",
    };

    const result = formatProjectLabelWithClient(project, "id-and-name", true);
    expect(result).toBe("PRJ-001 – Mobile App (ACME Corp)");
  });
});

describe("getProjectCode", () => {
  it("should prefer code over id", () => {
    const project: ProjectLike = {
      id: "UUID-123",
      code: "PRJ-001",
    };

    expect(getProjectCode(project)).toBe("PRJ-001");
  });

  it("should fallback to id when code is missing", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
    };

    expect(getProjectCode(project)).toBe("PRJ-001");
  });

  it("should return empty string when both are missing", () => {
    const project: ProjectLike = {
      id: "",
    };

    expect(getProjectCode(project)).toBe("");
  });
});

describe("getProjectName", () => {
  it("should return project name", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      name: "Mobile App",
    };

    expect(getProjectName(project)).toBe("Mobile App");
  });

  it("should return fallback when name is missing", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
    };

    expect(getProjectName(project)).toBe("Unnamed Project");
  });

  it("should return fallback when name is empty string", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      name: "",
    };

    expect(getProjectName(project)).toBe("Unnamed Project");
  });

  it("should trim whitespace", () => {
    const project: ProjectLike = {
      id: "PRJ-001",
      name: "  Mobile App  ",
    };

    expect(getProjectName(project)).toBe("Mobile App");
  });
});
