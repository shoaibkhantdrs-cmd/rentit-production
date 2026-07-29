"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.TooManyRequestsError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
/**
 * Base class for every error the application layer deliberately throws.
 * The HTTP layer (errorHandler middleware) maps `statusCode` + `code`
 * straight onto the response; anything that isn't an AppError is treated
 * as an unexpected bug and returns a generic 500.
 */
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode, code, details) {
        super(message);
        this.name = new.target.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace?.(this, new.target);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message = "Validation failed", details) {
        super(message, 400, "VALIDATION_ERROR", details);
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401, "UNAUTHORIZED");
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403, "FORBIDDEN");
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = "Not found") {
        super(message, 404, "NOT_FOUND");
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(message, 409, "CONFLICT");
    }
}
exports.ConflictError = ConflictError;
class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests") {
        super(message, 429, "TOO_MANY_REQUESTS");
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
/**
 * A downstream dependency (SMTP, SMS, a third-party API) failed in a way
 * that isn't the caller's fault and isn't a bug in our own logic --
 * distinct from an unclassified crash (which errorHandler.ts treats as a
 * generic 500 with no diagnosable code) so an operator reading logs can
 * immediately tell "our code has a bug" apart from "a dependency we don't
 * control is down/misconfigured."
 */
class ServiceUnavailableError extends AppError {
    constructor(message = "A required service is temporarily unavailable", details) {
        super(message, 503, "SERVICE_UNAVAILABLE", details);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
