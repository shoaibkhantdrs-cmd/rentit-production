/**
 * Base class for every error the application layer deliberately throws.
 * The HTTP layer (errorHandler middleware) maps `statusCode` + `code`
 * straight onto the response; anything that isn't an AppError is treated
 * as an unexpected bug and returns a generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "TOO_MANY_REQUESTS");
  }
}

/**
 * A downstream dependency (SMTP, SMS, a third-party API) failed in a way
 * that isn't the caller's fault and isn't a bug in our own logic --
 * distinct from an unclassified crash (which errorHandler.ts treats as a
 * generic 500 with no diagnosable code) so an operator reading logs can
 * immediately tell "our code has a bug" apart from "a dependency we don't
 * control is down/misconfigured."
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = "A required service is temporarily unavailable", details?: unknown) {
    super(message, 503, "SERVICE_UNAVAILABLE", details);
  }
}
