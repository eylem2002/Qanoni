import type { RequestHandler } from "express";
import { ValidationError } from "../../core/errors";
import { MESSAGES } from "../../core/constants";

/* Minimal structural shape of a Zod schema's safeParse. Declared
   structurally so any zod build (api-zod, clause schemas) is accepted
   regardless of which zod entry point produced it. */
interface Parsable<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { flatten(): unknown } };
}

/* Zod body-validation middleware factory. On success, replaces req.body
   with the parsed (typed) value so downstream handlers get clean data. */
export function validateBody<T>(schema: Parsable<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(MESSAGES.invalidBody, parsed.error.flatten()));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
