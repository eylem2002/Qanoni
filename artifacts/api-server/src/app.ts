import type { Express } from "express";
import { createApp } from "./bootstrap";

const app: Express = createApp();

export default app;
