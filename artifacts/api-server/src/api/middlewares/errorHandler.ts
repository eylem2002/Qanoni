import type { ErrorRequestHandler } from "express";
import { AppError } from "../../core/errors";
import { MESSAGES } from "../../core/constants";

/* Central error handler. Express 5 forwards rejected async handlers here.
   If a stream has already started (headers sent), we cannot send JSON —
   the streaming layer is responsible for emitting its own error event. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const status = err instanceof AppError ? err.status : 500;
  const expose = err instanceof AppError ? err.expose : false;

  if (status >= 500) {
    req.log.error({ err }, "Request failed");
  } else {
    req.log.warn({ err: (err as Error).message }, "Request rejected");
  }

  if (res.headersSent) {
    res.end();
    return;
  }

  const body: Record<string, unknown> = {
    error: expose ? (err as Error).message : MESSAGES.unexpected,
  };
  if (err instanceof AppError && err.details !== undefined) {
    body.details = err.details;
  }
  res.status(status).json(body);
};
