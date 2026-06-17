import type { Express } from "express";
import { initApi } from "./initApi";
import { initRoutes } from "./initRoutes";

/** Composes the fully-wired Express application. */
export function createApp(): Express {
  const app = initApi();
  initRoutes(app);
  return app;
}
