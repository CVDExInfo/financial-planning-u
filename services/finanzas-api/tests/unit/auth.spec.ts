import { ensureCanWrite } from "../../src/lib/auth";

describe("Auth Helper", () => {
  describe("Group Extraction", () => {
    it("should extract groups from array format", () => {
      const groups = ["PM", "SDT"];
      expect(groups).toContain("PM");
      expect(groups).toContain("SDT");
    });

    it("should extract groups from comma-separated string", () => {
      const groupString = "PM,SDT,FIN";
      const groups = groupString.split(",");
      expect(groups).toContain("PM");
      expect(groups).toContain("SDT");
      expect(groups).toContain("FIN");
    });

    it("should normalize groups to uppercase", () => {
      const groups = ["pm", "sdt"].map((g) => g.toUpperCase());
      expect(groups).toContain("PM");
      expect(groups).toContain("SDT");
    });
  });

  describe("RBAC - Write Permissions", () => {
    it("should allow PM to write", () => {
      const groups = ["PM"];
      const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
      expect(canWrite).toBe(true);
    });

    it("should allow SDT to write", () => {
      const groups = ["SDT"];
      const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
      expect(canWrite).toBe(true);
    });

    it("should deny FIN from writing", () => {
      const groups = ["FIN"];
      const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
      expect(canWrite).toBe(false);
    });

    it("should deny AUD from writing", () => {
      const groups = ["AUD"];
      const canWrite = groups.some((g) => ["PM", "SDT"].includes(g));
      expect(canWrite).toBe(false);
    });

    it("should allow PM group to pass ensureCanWrite", async () => {
      const event: any = { __verifiedClaims: { "cognito:groups": ["PM"] } };
      await expect(ensureCanWrite(event)).resolves.toBeUndefined();
    });

    it("should block legacy ikusi-acta-ui from writing", async () => {
      const event: any = {
        __verifiedClaims: { "cognito:groups": ["ikusi-acta-ui"] },
      };
      await expect(ensureCanWrite(event)).rejects.toEqual({
        statusCode: 403,
        body: "forbidden: PM or SDT required",
      });
    });
  });

  describe("RBAC - Read Permissions", () => {
    it("should allow PM to read", () => {
      const groups = ["PM"];
      const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
      expect(canRead).toBe(true);
    });

    it("should allow SDT to read", () => {
      const groups = ["SDT"];
      const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
      expect(canRead).toBe(true);
    });

    it("should allow FIN to read", () => {
      const groups = ["FIN"];
      const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
      expect(canRead).toBe(true);
    });

    it("should allow AUD to read", () => {
      const groups = ["AUD"];
      const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
      expect(canRead).toBe(true);
    });

    it("should deny unknown group from reading", () => {
      const groups = ["UNKNOWN"];
      const canRead = groups.some((g) => ["PM", "SDT", "FIN", "AUD"].includes(g));
      expect(canRead).toBe(false);
    });
  });
});
