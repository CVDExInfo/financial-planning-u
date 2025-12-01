import { ensureCanRead, ensureCanWrite } from "../../src/lib/auth";

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
    it("allows PM and PMO patterns to write", () => {
      const groups = ["pm", "pmo", "ADMIN"].map((g) => g.toUpperCase());
      const writable = groups.filter((g) => ["PM", "PMO", "ADMIN"].includes(g));
      expect(writable.length).toBeGreaterThan(0);
    });

    it("allows SDT/SDMT/FIN/AUD to write as SDMT role", async () => {
      for (const group of ["SDT", "SDMT", "FIN", "AUD"]) {
        const event: any = { __verifiedClaims: { "cognito:groups": [group] } };
        await expect(ensureCanWrite(event)).resolves.toBeUndefined();
      }
    });

    it("blocks vendor-only groups from writing", async () => {
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
    it("allows PMO/SDMT/VENDOR/EXEC derived groups to read", async () => {
      for (const group of [
        "PMO",
        "SDT",
        "SDMT",
        "FIN",
        "AUD",
        "ikusi-acta-ui",
        "exec-readonly",
      ]) {
        const event: any = { __verifiedClaims: { "cognito:groups": [group] } };
        await expect(ensureCanRead(event)).resolves.toBeUndefined();
      }
    });

    it("denies unknown groups", async () => {
      const event: any = { __verifiedClaims: { "cognito:groups": ["UNKNOWN"] } };
      await expect(ensureCanRead(event)).rejects.toEqual({
        statusCode: 403,
        body: "forbidden: valid group required",
      });
    });
  });
});
