import { ok } from "../lib/http";

export const handler = async () => {
  const env = process.env.STAGE_NAME || process.env.STAGE || "dev";
  const version = process.env.GIT_SHA || process.env.API_VERSION || "1.0.0";

  return ok({
    ok: true,
    status: "ok",
    env,
    version,
    timestamp: new Date().toISOString(),
  });
};
