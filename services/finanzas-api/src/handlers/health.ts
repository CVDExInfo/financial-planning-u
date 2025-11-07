export const handler = async () => {
  const stage = process.env.STAGE_NAME || process.env.STAGE || "dev";
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, service: 'finanzas-sd-api', stage, time: new Date().toISOString() })
  };
};
