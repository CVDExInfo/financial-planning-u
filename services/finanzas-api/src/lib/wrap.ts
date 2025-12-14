import { withCors } from "./http";

export function lambdaWrapper(handlerFn: (event: any, context: any) => Promise<any>) {
  return async (event: any, context: any) => {
    try {
      return await handlerFn(event, context);
    } catch (err: any) {
      const response = {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: err?.message || "Internal Server Error" }),
      };
      return withCors(response, event);
    }
  };
}

