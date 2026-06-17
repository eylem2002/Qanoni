import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../core/errors";

/* Gate: rejects the request with 401 unless a session user is present.
   Mounted before validation on protected routes so unauthenticated callers
   get 401 (auth) rather than 400 (bad body). */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session?.userId) {
    next(new UnauthorizedError());
    return;
  }
  next();
};
