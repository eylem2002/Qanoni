import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import { logger } from "../core/logger";
import { csrfGuard } from "../api/middlewares";

/* Builds the Express app and installs base middleware (logging, CORS,
   body parsing). Route registration happens separately in initRoutes. */
export function initApi(): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set for session management.");
  }

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({ pool, tableName: "session" }),
      name: "qanooni.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use(csrfGuard);

  return app;
}
