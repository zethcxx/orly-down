export class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AppError";
  }
}

export class HttpError extends AppError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly url: string,
  ) {
    super(message, `HTTP_${statusCode}`);
    this.name = "HttpError";
  }
}

export class RetryExhaustedError extends AppError {
  constructor(
    public readonly url      : string,
    public readonly attempts : number,
    public readonly lastError: Error,
  ) {
    super(
      `Request to ${url} failed after ${attempts} attempts: ${lastError.message}`,
      "RETRY_EXHAUSTED",
    );
    this.name = "RetryExhaustedError";
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export class NotFoundError extends AppError {
  constructor(public readonly resource: string) {
    super(`Resource not found: ${resource}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ParseError extends AppError {
  constructor(message: string, public readonly source?: string) {
    super(message, "PARSE_ERROR");
    this.name = "ParseError";
  }
}

