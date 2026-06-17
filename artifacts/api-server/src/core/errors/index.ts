/* ══════════════════════════════════════════════════════════
   ERROR HIERARCHY

   Every error thrown by the domain/logic layer extends AppError.
   The api/middlewares/errorHandler maps these to HTTP responses:
   `expose` decides whether the message is safe to send to the client.
══════════════════════════════════════════════════════════ */

export class AppError extends Error {
  readonly status: number;
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    status = 500,
    options?: { expose?: boolean; details?: unknown },
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.expose = options?.expose ?? status < 500;
    this.details = options?.details;
  }
}

/** 400 — bad input from the client. */
export class ValidationError extends AppError {
  constructor(message = "بيانات غير صحيحة", details?: unknown) {
    super(message, 400, { expose: true, details });
  }
}

/** 401 — authentication required or failed. */
export class UnauthorizedError extends AppError {
  constructor(message = "يجب تسجيل الدخول") {
    super(message, 401, { expose: true });
  }
}

/** 403 — authenticated but the request is not permitted (e.g. CSRF origin check). */
export class ForbiddenError extends AppError {
  constructor(message = "غير مصرّح") {
    super(message, 403, { expose: true });
  }
}

/** 404 — resource not found. */
export class NotFoundError extends AppError {
  constructor(message = "غير موجود") {
    super(message, 404, { expose: true });
  }
}

/** 409 — resource conflict (e.g. duplicate email). */
export class ConflictError extends AppError {
  constructor(message = "تعارض في البيانات") {
    super(message, 409, { expose: true });
  }
}

/** 422 — input understood but cannot be processed. */
export class UnprocessableError extends AppError {
  constructor(message = "تعذر معالجة الطلب") {
    super(message, 422, { expose: true });
  }
}

/** 429 — rate limit exceeded. */
export class RateLimitError extends AppError {
  constructor(message = "تجاوزت الحد المسموح به") {
    super(message, 429, { expose: true });
  }
}

/** 502 — an external service (e.g. the law system, the model) failed. */
export class ServiceError extends AppError {
  constructor(message = "فشل في خدمة خارجية") {
    super(message, 502, { expose: false });
  }
}
