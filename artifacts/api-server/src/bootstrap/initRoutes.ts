import type { Express } from "express";
import apiRouter from "../api/routes";
import {
  contractRateLimiter,
  reviewRateLimiter,
  notFoundHandler,
  errorHandler,
} from "../api/middlewares";

/* Mounts rate limiters, the aggregated API router, and the terminal
   not-found + error handlers. Order matters: limiters before routes,
   handlers last. */
export function initRoutes(app: Express): void {
  app.use("/api/contracts/review", reviewRateLimiter);
  app.use("/api/contracts", contractRateLimiter);

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
}
