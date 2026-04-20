/**
 * Error DTOs
 * Standardized error response format
 */

/**
 * API Error Response DTO
 */
export class ErrorResponseDTO {
  constructor(
    statusCode,
    message,
    error = null,
    details = null,
    timestamp = new Date().toISOString(),
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.error = error;
    this.details = details;
    this.timestamp = timestamp;
    this.success = false;
  }

  static BadRequest(message, details = null) {
    return new ErrorResponseDTO(
      400,
      message || "Bad Request",
      "BAD_REQUEST",
      details,
    );
  }

  static Unauthorized(message = "Unauthorized", details = null) {
    return new ErrorResponseDTO(401, message, "UNAUTHORIZED", details);
  }

  static Forbidden(message = "Forbidden", details = null) {
    return new ErrorResponseDTO(403, message, "FORBIDDEN", details);
  }

  static NotFound(message = "Not Found", details = null) {
    return new ErrorResponseDTO(404, message, "NOT_FOUND", details);
  }

  static Conflict(message, details = null) {
    return new ErrorResponseDTO(
      409,
      message || "Conflict",
      "CONFLICT",
      details,
    );
  }

  static InternalServer(message = "Internal Server Error", details = null) {
    return new ErrorResponseDTO(500, message, "INTERNAL_SERVER_ERROR", details);
  }

  static ValidationError(message, details = null) {
    return new ErrorResponseDTO(
      422,
      message || "Validation Error",
      "VALIDATION_ERROR",
      details,
    );
  }
}

/**
 * Success Response DTO
 */
export class SuccessResponseDTO {
  constructor(data = null, message = "Success", statusCode = 200) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
    this.success = true;
  }
}

export default {
  ErrorResponseDTO,
  SuccessResponseDTO,
};
