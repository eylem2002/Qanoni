import type { RequestHandler } from "express";
import { MESSAGES } from "../../core/constants";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: MESSAGES.notFound });
};
