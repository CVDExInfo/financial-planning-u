import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const isDevEnvironment =
  process.env.NODE_ENV === "development" ||
  process.env.STAGE_NAME === "local" ||
  process.env.STAGE_NAME === "dev";

const parseAllowedOrigins = () => {
  const envValue = process.env.ALLOWED_ORIGIN || "";
  return envValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const isEvent = (value: unknown): value is APIGatewayProxyEvent => {
  return typeof value === "object" && value !== null && "headers" in value;
};

export function defaultCorsHeaders(event?: Pick<APIGatewayProxyEvent, "headers">) {
  const originHeader = event?.headers?.Origin || event?.headers?.origin;
  const allowedOrigins = parseAllowedOrigins();
  const isAllowedOrigin =
    !!originHeader && allowedOrigins.some((allowed) => allowed === originHeader);
  const allowOrigin =
    (isAllowedOrigin && originHeader) ||
    allowedOrigins[0] ||
    (isDevEnvironment ? "*" : "*");

  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Idempotency-Key,X-Amz-Date,X-Amz-Security-Token,X-Requested-With,X-Api-Key",
    "Access-Control-Max-Age": "86400",
  };

  if (String(process.env.ALLOW_CREDENTIALS).toLowerCase() === "true") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function withCors(
  response: APIGatewayProxyResult,
  event?: Pick<APIGatewayProxyEvent, "headers">
): APIGatewayProxyResult {
  return {
    ...response,
    headers: {
      ...defaultCorsHeaders(event),
      ...(response.headers || {}),
    },
  };
}

export function ok<T>(
  eventOrData: APIGatewayProxyEvent | T,
  dataOrStatus?: T | number,
  statusCode?: number
): APIGatewayProxyResult {
  const event = isEvent(eventOrData) ? eventOrData : undefined;
  const data = isEvent(eventOrData)
    ? (dataOrStatus as T)
    : (eventOrData as T);
  const status =
    typeof statusCode === "number"
      ? statusCode
      : typeof dataOrStatus === "number" && !isEvent(eventOrData)
        ? dataOrStatus
        : 200;

  return withCors(
    {
      statusCode: status,
      headers: {},
      body: JSON.stringify(data),
    },
    event
  );
}

export function noContent(
  eventOrStatus?: APIGatewayProxyEvent | number,
  maybeStatus?: number
): APIGatewayProxyResult {
  const event = isEvent(eventOrStatus) ? eventOrStatus : undefined;
  const status =
    typeof maybeStatus === "number"
      ? maybeStatus
      : typeof eventOrStatus === "number"
        ? eventOrStatus
        : 204;

  return withCors(
    {
      statusCode: status,
      headers: {},
      body: "",
    },
    event
  );
}

export function bad(
  eventOrMessage: APIGatewayProxyEvent | string | Record<string, unknown>,
  messageOrStatus?: string | Record<string, unknown> | number,
  statusCode?: number
): APIGatewayProxyResult {
  const event = isEvent(eventOrMessage) ? eventOrMessage : undefined;
  const message = isEvent(eventOrMessage)
    ? (messageOrStatus as string | Record<string, unknown>)
    : (eventOrMessage as string | Record<string, unknown>);
  const status =
    typeof statusCode === "number"
      ? statusCode
      : typeof messageOrStatus === "number" && isEvent(eventOrMessage)
        ? messageOrStatus
        : typeof messageOrStatus === "number"
          ? messageOrStatus
          : 400;

  return withCors(
    {
      statusCode: status,
      headers: {},
      body:
        typeof message === "string"
          ? JSON.stringify({ error: message })
          : JSON.stringify(message),
    },
    event
  );
}

export function notFound(
  eventOrMessage: APIGatewayProxyEvent | string,
  message = "Resource not found"
) {
  return isEvent(eventOrMessage)
    ? bad(eventOrMessage, message, 404)
    : bad(eventOrMessage || message, 404);
}

export function serverError(
  eventOrMessage?: APIGatewayProxyEvent | string,
  message = "Internal server error"
) {
  if (isEvent(eventOrMessage)) {
    return bad(eventOrMessage, message, 500);
  }

  const body = typeof eventOrMessage === "string" ? eventOrMessage : message;
  return bad(body, 500);
}

export function notImplemented(
  eventOrMessage: APIGatewayProxyEvent | string,
  message = "Not implemented"
) {
  return isEvent(eventOrMessage)
    ? bad(eventOrMessage, message, 501)
    : bad(eventOrMessage || message, 501);
}

export function unauthorized(
  eventOrMessage: APIGatewayProxyEvent | string,
  message = "Unauthorized"
) {
  return isEvent(eventOrMessage)
    ? bad(eventOrMessage, message, 401)
    : bad(eventOrMessage || message, 401);
}

export function fromAuthError(error: unknown, event?: APIGatewayProxyEvent) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    "body" in error
  ) {
    const statusCode = Number((error as { statusCode: number }).statusCode) || 403;
    const message = String((error as { body: string }).body || "Access denied");
    return event ? bad(event, message, statusCode) : bad(message, statusCode);
  }
  return null;
}
