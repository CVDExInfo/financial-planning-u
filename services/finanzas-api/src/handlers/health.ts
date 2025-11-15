export const handler = async () => {
  const env = process.env.STAGE_NAME || process.env.STAGE || "dev";
  const version = process.env.API_VERSION || "1.0.0";
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      ok: true, 
      status: 'ok',
      env,
      version
    })
  };
};
