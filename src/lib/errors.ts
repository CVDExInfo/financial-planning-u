export class AuthError extends Error {
  constructor(
    public code: "AUTH_REQUIRED" | "FORBIDDEN" | string,
    message: string,
    public status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class ValidationError extends Error {
  constructor(public code: string, message: string, public status: number = 400) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ServerError extends Error {
  constructor(public code: string, message: string, public status: number = 500) {
    super(message);
    this.name = "ServerError";
  }
}

export type ApiError = AuthError | ValidationError | ServerError;
